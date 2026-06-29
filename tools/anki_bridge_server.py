import argparse
import base64
import html
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

for _stream in (sys.stdout, sys.stderr):
    try:
        current_encoding = getattr(_stream, "encoding", None) or "utf-8"
        _stream.reconfigure(encoding=current_encoding, errors="replace")
    except Exception:
        pass


ANKICONNECT_URL = "http://127.0.0.1:8765"
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 5051
DEFAULT_MODEL = "Lapis"
DEFAULT_DECK = "Default"
DEFAULT_NOTE_TAGS = ["VouoA"]
DEFAULT_FIELD_MAP = {
    "Expression": "{expression}",
    "ExpressionFurigana": "{furigana-plain}",
    "ExpressionReading": "{reading}",
    "MainDefinition": "{glossary-first}",
    "Sentence": "{cloze-sentence}",
    "SentenceAudio": "{cut-audio}",
    "Picture": "{picture}",
    "Glossary": "{glossary}",
    "IsClickCard": "x",
    "PitchPosition": "{pitch-accent-positions}",
    "Frequency": "{frequencies}",
    "FreqSort": "{frequency-harmonic-rank}",
}
CONFIG_FILE_NAME = "anki_bridge_config.json"
LOOKUP_MAX_MATCH_LENGTH = 16
LOOKUP_MAX_BACKTRACK = 8
HTTP_TIMEOUT_SECONDS = 8
YOMITAN_ANKI_FIELDS_TIMEOUT_SECONDS = 25
ANKI_LONG_TIMEOUT_SECONDS = 30


def is_japanese_char(character):
    return bool(re.search(r"[一-龯々ぁ-ゖァ-ヺー]", str(character or "")))


def is_client_disconnect_error(error):
    if isinstance(error, (BrokenPipeError, ConnectionResetError, ConnectionAbortedError)):
        return True
    if isinstance(error, OSError):
        return getattr(error, "errno", None) in (32, 54, 10053, 10054)
    return False


def parse_args():
    parser = argparse.ArgumentParser(
        description="Receive card payloads over HTTP and forward them to desktop Anki via AnkiConnect."
    )
    parser.add_argument("--host", default=DEFAULT_HOST, help=f"Bind host. Default: {DEFAULT_HOST}")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Bind port. Default: {DEFAULT_PORT}")
    parser.add_argument("--anki-url", default=ANKICONNECT_URL, help=f"AnkiConnect URL. Default: {ANKICONNECT_URL}")
    parser.add_argument("--default-model", default=DEFAULT_MODEL, help=f"Default model. Default: {DEFAULT_MODEL}")
    parser.add_argument("--default-deck", default=None, help=f"Default deck. Default: {DEFAULT_DECK}")
    parser.add_argument(
        "--select-deck-on-start",
        action="store_true",
        help="Prompt to choose deck when server starts (saved for next launch).",
    )
    parser.add_argument(
        "--reselect-deck",
        action="store_true",
        help="Force selecting deck again when --select-deck-on-start is used.",
    )
    parser.add_argument(
        "--yt-dlp-bin",
        default="yt-dlp",
        help="yt-dlp executable path or command name. Default: yt-dlp",
    )
    parser.add_argument(
        "--yt-dlp-cookies-from-browser",
        default="",
        help="Optional browser name passed to yt-dlp --cookies-from-browser, e.g. edge/chrome/firefox.",
    )
    parser.add_argument(
        "--yomitan-api-url",
        default="http://127.0.0.1:19633",
        help="Base URL for yomitan-api. Default: http://127.0.0.1:19633",
    )
    parser.add_argument(
        "--log-file",
        default="",
        help="Optional log file path for bridge activity.",
    )
    return parser.parse_args()


def invoke_anki(action, params=None, anki_url=ANKICONNECT_URL):
    payload = {"action": action, "version": 6, "params": params or {}}
    request = urllib.request.Request(
        anki_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        timeout = ANKI_LONG_TIMEOUT_SECONDS if action in {"storeMediaFile", "addNote"} else HTTP_TIMEOUT_SECONDS
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
    except TimeoutError as error:
        raise RuntimeError(f"Timed out calling AnkiConnect action {action}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(
            f"Cannot reach AnkiConnect at {anki_url}. Make sure desktop Anki is open and AnkiConnect is installed."
        ) from error

    data = json.loads(body)
    if data.get("error"):
        raise RuntimeError(str(data["error"]))
    return data.get("result")


def ensure_deck(deck_name, anki_url):
    decks = invoke_anki("deckNames", anki_url=anki_url)
    if deck_name not in decks:
        invoke_anki("createDeck", {"deck": deck_name}, anki_url=anki_url)


def runtime_dir():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def config_path():
    return os.path.join(runtime_dir(), CONFIG_FILE_NAME)


def append_log_file(log_file, line):
    path = str(log_file or "").strip()
    if not path:
        return
    directory = os.path.dirname(path)
    if directory:
        try:
            os.makedirs(directory, exist_ok=True)
        except OSError:
            pass
    try:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(f"{line}\n")
    except OSError:
        pass


def emit_log(message, log_file=""):
    line = str(message or "")
    try:
        print(line, flush=True)
    except Exception:
        try:
            encoding = getattr(sys.stdout, "encoding", None) or "utf-8"
            safe_line = line.encode(encoding, errors="replace").decode(encoding, errors="replace")
            sys.stdout.write(f"{safe_line}\n")
            sys.stdout.flush()
        except Exception:
            pass
    append_log_file(log_file, line)


def load_saved_config():
    path = config_path()
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_saved_config(updates):
    path = config_path()
    payload = load_saved_config()
    payload.update(updates or {})
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def load_saved_default_deck():
    data = load_saved_config()
    return str(data.get("default_deck", "") or "").strip()


def load_saved_default_model():
    data = load_saved_config()
    return str(data.get("default_model", "") or "").strip()


def load_saved_duplicate_check():
    data = load_saved_config()
    return bool(data.get("duplicate_check", False))


def load_saved_field_map():
    data = load_saved_config()
    field_map = data.get("field_map")
    return field_map if isinstance(field_map, dict) else {}


def parse_note_tags(raw_value):
    if isinstance(raw_value, (list, tuple, set)):
        source = " ".join(str(item or "") for item in raw_value)
    else:
        source = str(raw_value or "")
    parts = re.split(r"[\s,]+", source.strip())
    seen = set()
    result = []
    for part in parts:
        tag = str(part or "").strip()
        if not tag or tag in seen:
            continue
        seen.add(tag)
        result.append(tag)
    return result


def load_saved_default_tags():
    data = load_saved_config()
    tags = parse_note_tags(data.get("default_tags", ""))
    return tags or list(DEFAULT_NOTE_TAGS)


def save_saved_default_deck(deck_name):
    if not deck_name:
        return
    save_saved_config({"default_deck": deck_name})


def find_installed_binary(binary_name, package_glob="", nested_glob=""):
    direct = shutil.which(binary_name) or shutil.which(f"{binary_name}.exe")
    if direct:
        return direct

    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if not local_app_data or not package_glob or not nested_glob:
        return ""

    packages_root = os.path.join(local_app_data, "Microsoft", "WinGet", "Packages")
    if not os.path.isdir(packages_root):
        return ""

    try:
        import glob

        package_matches = glob.glob(os.path.join(packages_root, package_glob))
        package_matches.sort(reverse=True)
        for package_dir in package_matches:
            candidate_matches = glob.glob(os.path.join(package_dir, nested_glob))
            candidate_matches.sort(reverse=True)
            for candidate in candidate_matches:
                if os.path.isfile(candidate):
                    return candidate
    except Exception:  # noqa: BLE001
        return ""
    return ""


def choose_deck_on_start(args):
    try:
        decks = invoke_anki("deckNames", anki_url=args.anki_url)
    except Exception as error:  # noqa: BLE001
        print(f"Deck selection skipped: cannot query AnkiConnect ({error})")
        return ""

    if not decks:
        print("Deck selection skipped: no existing decks found.")
        return ""

    sorted_decks = sorted(decks, key=lambda item: item.lower())
    print("\nChoose default deck:")
    for index, deck in enumerate(sorted_decks, start=1):
        marker = " (current)" if deck == args.default_deck else ""
        print(f"  {index}. {deck}{marker}")
    print("Press Enter to keep current default.")

    try:
        raw = input(f"Deck [1-{len(sorted_decks)}] (default: {args.default_deck}): ").strip()
    except EOFError:
        return ""
    except KeyboardInterrupt:
        print("\nDeck selection cancelled. Keep current default.")
        return

    if not raw:
        return ""

    if raw.isdigit():
        selected = int(raw)
        if 1 <= selected <= len(sorted_decks):
            args.default_deck = sorted_decks[selected - 1]
            print(f"Selected deck: {args.default_deck}")
            return args.default_deck

    if raw in sorted_decks:
        args.default_deck = raw
        print(f"Selected deck: {args.default_deck}")
        return args.default_deck

    print("Invalid selection. Keep current default.")
    return ""


def sanitize_filename(value, fallback):
    cleaned = re.sub(r'[\\/:*?"<>|]+', " ", str(value or "")).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned or fallback


def guess_extension(filename, mime_type, fallback):
    mime = (mime_type or "").split(";")[0].strip().lower()
    if filename:
        suffix = urllib.parse.urlparse(filename).path
        suffix = suffix[suffix.rfind(".") :] if "." in suffix else ""
        if suffix:
            return suffix
    if mime:
        guessed = mimetypes.guess_extension(mime)
        if guessed:
            return guessed
    return fallback


def build_audio_name(payload):
    filename = payload.get("audio-file", "")
    if filename:
        return sanitize_filename(filename, "audio.m4a")
    expression = sanitize_filename(payload.get("expression", ""), "audio")
    reading = sanitize_filename(payload.get("reading", ""), "")
    suffix = f"-{reading}" if reading else ""
    extension = guess_extension("", payload.get("audio-mime", ""), ".m4a")
    return f"{expression}{suffix}{extension}"


def build_image_name(payload):
    filename = payload.get("screenshot-file", "")
    if filename:
        return sanitize_filename(filename, "screenshot.jpg")
    expression = sanitize_filename(payload.get("expression", ""), "screenshot")
    extension = guess_extension("", payload.get("screenshot-mime", ""), ".jpg")
    return f"{expression}{extension}"


def store_media_file(filename, base64_data, anki_url):
    return invoke_anki(
        "storeMediaFile",
        {
            "filename": filename,
            "data": base64_data,
        },
        anki_url=anki_url,
    )


def normalize_remote_url(url):
    raw = str(url or "").strip()
    if not raw:
        return ""
    normalized = raw.replace("\\", "/")
    parsed = urllib.parse.urlsplit(normalized)
    path = urllib.parse.quote(parsed.path, safe="/%:@+")
    query = urllib.parse.quote(parsed.query, safe="=&/%:@+")
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, path, query, parsed.fragment))


def fetch_url_bytes(url, referer=""):
    request_url = normalize_remote_url(url)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
    }
    if referer:
        headers["Referer"] = normalize_remote_url(referer)
    request = urllib.request.Request(request_url, headers=headers)
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
        return response.read(), response.headers.get("Content-Type", "")


def invoke_json_api(url, payload=None, method="POST", timeout_seconds=HTTP_TIMEOUT_SECONDS):
    body = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            raw = response.read().decode("utf-8")
    except TimeoutError as error:
        raise RuntimeError(f"Timed out calling {url}") from error
    except urllib.error.HTTPError as error:
        try:
            details = error.read().decode("utf-8", errors="replace").strip()
        except Exception:  # noqa: BLE001
            details = str(error)
        raise RuntimeError(f"HTTP {error.code} from {url}: {details}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Cannot reach {url}") from error

    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Invalid JSON returned from {url}") from error


def build_yomitan_api_url(base_url, path):
    normalized_base = str(base_url or "").rstrip("/")
    normalized_path = "/" + str(path or "").lstrip("/")
    return f"{normalized_base}{normalized_path}"


def yomitan_api_request(args, path, payload=None, timeout_seconds=HTTP_TIMEOUT_SECONDS):
    candidate_paths = [path]
    normalized_path = "/" + str(path or "").lstrip("/")
    if not normalized_path.startswith("/api/"):
        candidate_paths.append(f"/api{normalized_path}")

    errors = []
    for candidate in candidate_paths:
        url = build_yomitan_api_url(args.yomitan_api_url, candidate)
        try:
            return invoke_json_api(url, payload=payload, timeout_seconds=timeout_seconds)
        except Exception as error:  # noqa: BLE001
            errors.append(f"{candidate}: {error}")

    raise RuntimeError(" ; ".join(errors))


def build_term_entries_payload(term):
    return {
        "term": term,
    }


def build_anki_fields_payload(term):
    return {
        "text": term,
        "type": "term",
        "markers": [
            "audio",
            "conjugation",
            "dictionary",
            "dictionary-alias",
            "expression",
            "frequency-average-occurrence",
            "frequency-average-rank",
            "frequencies",
            "frequency-harmonic-occurrence",
            "frequency-harmonic-rank",
            "furigana",
            "furigana-plain",
            "glossary",
            "glossary-brief",
            "glossary-first",
            "glossary-first-brief",
            "glossary-first-no-dictionary",
            "glossary-no-dictionary",
            "glossary-plain",
            "glossary-plain-no-dictionary",
            "part-of-speech",
            "phonetic-transcriptions",
            "reading",
            "tags",
            "pitch-accents",
            "pitch-accent-categories",
            "pitch-accent-positions",
        ],
        "maxEntries": 20,
        "includeMedia": True,
    }


def extract_lookup_entries(result):
    if isinstance(result, list):
        return result
    if not isinstance(result, dict):
        return []
    for key in ("dictionaryEntries", "fields", "entries", "results", "data", "items"):
        value = result.get(key)
        if isinstance(value, list):
            return value
    return []


def request_lookup_result(args, term):
    return yomitan_api_request(args, "/termEntries", build_term_entries_payload(term))


def request_anki_fields_result(args, term):
    return yomitan_api_request(
        args,
        "/ankiFields",
        build_anki_fields_payload(term),
        timeout_seconds=YOMITAN_ANKI_FIELDS_TIMEOUT_SECONDS,
    )


def first_text(*values):
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def shorten_text(value, limit=240):
    text = str(value or "").replace("\r", " ").replace("\n", " ").strip()
    if len(text) <= limit:
        return text
    return text[:limit] + "..."


def parse_json_field(value, fallback):
    if value is None or value == "":
        return fallback
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(str(value))
    except Exception:  # noqa: BLE001
        return fallback


def _split_css_selectors(selector_text):
    return [part.strip() for part in str(selector_text or "").split(",") if str(part or "").strip()]


def _combine_css_selector_prefixes(prefixes, selector_text):
    selectors = _split_css_selectors(selector_text)
    if not selectors:
        return []
    normalized_prefixes = prefixes or [""]
    combined = []
    for prefix in normalized_prefixes:
        prefix_text = str(prefix or "").strip()
        for selector in selectors:
            combined.append(f"{prefix_text} {selector}".strip() if prefix_text else selector)
    return combined


def _consume_css_block(text, start_index):
    depth = 0
    body_start = start_index + 1
    for index in range(start_index, len(text)):
        char = text[index]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[body_start:index], index + 1
    return text[body_start:], len(text)


def _flatten_nested_css(css_text, prefixes=None):
    text = str(css_text or "").strip()
    if not text:
        return []

    rules = []
    index = 0
    length = len(text)
    while index < length:
        while index < length and text[index].isspace():
            index += 1
        if index >= length:
            break
        brace_index = text.find("{", index)
        if brace_index == -1:
            break
        selector = text[index:brace_index].strip()
        body, next_index = _consume_css_block(text, brace_index)
        if selector:
            combined_selectors = _combine_css_selector_prefixes(prefixes or [""], selector)
            if "{" in body:
                rules.extend(_flatten_nested_css(body, combined_selectors))
            else:
                declaration_text = body.strip()
                if declaration_text and combined_selectors:
                    rules.append(f"{', '.join(combined_selectors)} {{{declaration_text}}}")
        index = next_index
    return rules


def normalize_yomitan_style_blocks(value):
    if not isinstance(value, str) or "<style>" not in value:
        return value

    def replace_style_block(match):
        css_text = match.group(1)
        flattened_rules = _flatten_nested_css(css_text)
        if not flattened_rules:
            return match.group(0)
        return "<style>" + "\n".join(flattened_rules) + "</style>"

    return re.sub(r"<style>([\s\S]*?)</style>", replace_style_block, value)


def normalize_yomitan_fields(value):
    if isinstance(value, dict):
        return {key: normalize_yomitan_fields(item) for key, item in value.items()}
    if isinstance(value, list):
        return [normalize_yomitan_fields(item) for item in value]
    return normalize_yomitan_style_blocks(value)


def render_template(template, values):
    result = str(template or "")
    for key, value in values.items():
        result = result.replace("{" + key + "}", str(value or ""))
    return result


def first_value_text(payload, yomitan_fields, *keys, fallback_keys=None):
    values = []
    for key in keys:
        if key in yomitan_fields:
            values.append(yomitan_fields.get(key))
        if key in payload:
            values.append(payload.get(key))
    if fallback_keys:
        for key in fallback_keys:
            if key in yomitan_fields:
                values.append(yomitan_fields.get(key))
            if key in payload:
                values.append(payload.get(key))
    return first_text(*values)


def ensure_sound_tag(value):
    text = str(value or "").strip()
    if not text:
        return ""
    if text.startswith("[sound:") and text.endswith("]"):
        return text
    return f"[sound:{text}]"


def extract_yomitan_audio_reference(raw_result, yomitan_fields, expression="", reading="", stored_filenames=None):
    audio_value = yomitan_fields.get("audio")
    allowed_filenames = {str(item or "").strip() for item in (stored_filenames or []) if str(item or "").strip()}
    if isinstance(audio_value, dict):
        tagged = ensure_sound_tag(audio_value.get("value"))
        if not tagged:
            return ""
        if not allowed_filenames:
            return tagged
        filename = tagged[7:-1] if tagged.startswith("[sound:") and tagged.endswith("]") else ""
        return tagged if filename in allowed_filenames else ""
    if isinstance(audio_value, str):
        tagged = ensure_sound_tag(audio_value)
        if not tagged:
            return ""
        if not allowed_filenames:
            return tagged
        filename = tagged[7:-1] if tagged.startswith("[sound:") and tagged.endswith("]") else ""
        return tagged if filename in allowed_filenames else ""

    expression_text = str(expression or "").strip()
    reading_text = str(reading or "").strip()
    for item in extract_audio_media(raw_result):
        if not isinstance(item, dict):
            continue
        filename = sanitize_filename(item.get("ankiFilename", "") or item.get("filename", ""), "")
        if not filename:
            continue
        item_term = str(item.get("term", "") or "").strip()
        item_reading = str(item.get("reading", "") or "").strip()
        if expression_text and item_term and item_term != expression_text:
            continue
        if reading_text and item_reading and item_reading != reading_text:
            continue
        if allowed_filenames and filename not in allowed_filenames:
            continue
        return ensure_sound_tag(filename)
    return ""


def build_value_map(payload, sentence_audio_reference="", expression_audio_reference="", picture_reference="", yomitan_fields=None, yomitan_audio_reference=""):
    yomitan_fields = yomitan_fields or {}
    expression = first_text(yomitan_fields.get("expression"), payload.get("expression"))
    reading = first_text(yomitan_fields.get("reading"), payload.get("reading"))
    sentence = first_text(payload.get("sentence"), yomitan_fields.get("sentence"))
    sentence_html = payload.get("sentence-html") or sentence
    glossary = first_value_text(payload, yomitan_fields, "glossary")
    glossary_first = first_value_text(payload, yomitan_fields, "glossary-first", fallback_keys=("glossary",))
    value_map = {
        "audio": yomitan_audio_reference,
        "cut-audio": sentence_audio_reference,
        "picture": picture_reference,
        "screenshot": first_text(picture_reference, yomitan_fields.get("screenshot")),
        "expression": expression,
        "furigana-plain": first_value_text(payload, yomitan_fields, "furigana-plain", fallback_keys=("furigana",)),
        "furigana": first_value_text(payload, yomitan_fields, "furigana", fallback_keys=("furigana-plain",)),
        "reading": reading,
        "glossary-first": glossary_first,
        "glossary-first-brief": first_value_text(payload, yomitan_fields, "glossary-first-brief", fallback_keys=("glossary-first", "glossary")),
        "glossary-first-no-dictionary": first_value_text(payload, yomitan_fields, "glossary-first-no-dictionary", fallback_keys=("glossary-first", "glossary")),
        "glossary": glossary,
        "glossary-brief": first_value_text(payload, yomitan_fields, "glossary-brief", fallback_keys=("glossary",)),
        "glossary-no-dictionary": first_value_text(payload, yomitan_fields, "glossary-no-dictionary", fallback_keys=("glossary",)),
        "glossary-plain": first_value_text(payload, yomitan_fields, "glossary-plain", fallback_keys=("glossary",)),
        "glossary-plain-no-dictionary": first_value_text(payload, yomitan_fields, "glossary-plain-no-dictionary", fallback_keys=("glossary-plain", "glossary")),
        "pitch-accent-positions": first_value_text(payload, yomitan_fields, "pitch-accent-positions", fallback_keys=("pitch-position",)),
        "pitch-position": first_value_text(payload, yomitan_fields, "pitch-accent-positions", fallback_keys=("pitch-position",)),
        "pitch-accent-categories": first_value_text(payload, yomitan_fields, "pitch-accent-categories"),
        "pitch-accents": first_value_text(payload, yomitan_fields, "pitch-accents"),
        "frequencies": first_value_text(payload, yomitan_fields, "frequencies", fallback_keys=("frequency",)),
        "frequency": first_value_text(payload, yomitan_fields, "frequencies", fallback_keys=("frequency",)),
        "frequency-harmonic-rank": first_value_text(payload, yomitan_fields, "frequency-harmonic-rank"),
        "frequency-harmonic-occurrence": first_value_text(payload, yomitan_fields, "frequency-harmonic-occurrence"),
        "frequency-average-rank": first_value_text(payload, yomitan_fields, "frequency-average-rank"),
        "frequency-average-occurrence": first_value_text(payload, yomitan_fields, "frequency-average-occurrence"),
        "dictionary": first_value_text(payload, yomitan_fields, "dictionary"),
        "dictionary-alias": first_value_text(payload, yomitan_fields, "dictionary-alias"),
        "part-of-speech": first_value_text(payload, yomitan_fields, "part-of-speech"),
        "conjugation": first_value_text(payload, yomitan_fields, "conjugation"),
        "phonetic-transcriptions": first_value_text(payload, yomitan_fields, "phonetic-transcriptions"),
        "tags": first_value_text(payload, yomitan_fields, "tags"),
        "search-query": first_value_text(payload, yomitan_fields, "search-query"),
        "popup-selection-text": first_value_text(payload, yomitan_fields, "popup-selection-text"),
        "document-title": first_value_text(payload, yomitan_fields, "document-title"),
        "sentence": sentence,
        "sentence-html": sentence_html,
        "sentence-furigana": first_value_text(payload, yomitan_fields, "sentence-furigana", fallback_keys=("sentence",)),
        "sentence-furigana-plain": first_value_text(payload, yomitan_fields, "sentence-furigana-plain", fallback_keys=("sentence",)),
        "cloze-prefix": first_text(payload.get("cloze-prefix"), yomitan_fields.get("cloze-prefix")),
        "cloze-body": first_text(payload.get("cloze-body"), yomitan_fields.get("cloze-body")),
        "cloze-body-kana": first_text(payload.get("cloze-body-kana"), yomitan_fields.get("cloze-body-kana")),
        "cloze-suffix": first_text(payload.get("cloze-suffix"), yomitan_fields.get("cloze-suffix")),
        "cloze-sentence": first_text(
            payload.get("cloze-sentence"),
            yomitan_fields.get("cloze-sentence"),
            payload.get("sentence-html"),
            payload.get("sentence"),
            yomitan_fields.get("sentence-html"),
            yomitan_fields.get("sentence"),
        ),
        "start": first_text(payload.get("start"), payload.get("clip-start")),
        "end": first_text(payload.get("end"), payload.get("clip-end")),
        "clip-start": first_text(payload.get("clip-start"), payload.get("start")),
        "clip-end": first_text(payload.get("clip-end"), payload.get("end")),
        "url": first_text(payload.get("source-page-url"), yomitan_fields.get("url")),
    }
    for key, value in yomitan_fields.items():
        if key not in value_map:
            value_map[key] = value
    return value_map


def build_fields_from_map(field_map, values):
    fields = {}
    for field_name, template in (field_map or {}).items():
        name = str(field_name or "").strip()
        if not name:
            continue
        fields[name] = render_template(template, values)
    return fields


def find_duplicate_notes(payload, fields, args):
    expression = first_text(payload.get("expression"), payload.get("term"), payload.get("reading"))
    if not expression:
        return []
    deck_name = payload.get("deck") or load_saved_default_deck() or args.default_deck
    field_map = parse_json_field(payload.get("fieldMap"), {}) or load_saved_field_map() or DEFAULT_FIELD_MAP
    expression_fields = [
        name
        for name, template in field_map.items()
        if str(template).strip() in ("{expression}", "expression")
    ]
    if not expression_fields:
        expression_fields = [
            name
            for name, value in fields.items()
            if str(value or "").strip() == expression
        ]
    if not expression_fields:
        expression_fields = ["Expression", "Word", "Vocab", "Term"]
    deck_filter = f'deck:"{deck_name}" ' if deck_name else ""
    safe_expression = re.escape(expression)
    seen = []
    for field_name in expression_fields:
        query = f'{deck_filter}{field_name}:re:^{safe_expression}$'
        try:
            notes = invoke_anki("findNotes", {"query": query}, args.anki_url) or []
        except Exception:  # noqa: BLE001
            notes = []
        for note_id in notes:
            if note_id not in seen:
                seen.append(note_id)
    return seen


def extract_first_anki_fields(result):
    if isinstance(result, dict):
        top_level_fields = result.get("fields")
        if isinstance(top_level_fields, list) and top_level_fields:
            first_item = top_level_fields[0]
            return first_item if isinstance(first_item, dict) else {}
        if isinstance(top_level_fields, dict):
            return top_level_fields

    entries = extract_lookup_entries(result)
    if not entries:
        return {}
    first_entry = entries[0]
    if not isinstance(first_entry, dict):
        return {}
    nested_fields = first_entry.get("fields")
    if isinstance(nested_fields, dict):
        return nested_fields
    return first_entry if isinstance(first_entry, dict) else {}


def extract_audio_media(result):
    if not isinstance(result, dict):
        return []
    audio_media = result.get("audioMedia")
    return audio_media if isinstance(audio_media, list) else []


def decode_yomitan_audio_sources(item):
    if not isinstance(item, dict):
        return []
    content = str(item.get("content", "") or "").strip()
    if not content:
        return []
    try:
        decoded = base64.b64decode(content)
        payload = json.loads(decoded.decode("utf-8"))
    except Exception:  # noqa: BLE001
        return []
    if not isinstance(payload, dict) or payload.get("type") != "audioSourceList":
        return []
    sources = payload.get("audioSources")
    return sources if isinstance(sources, list) else []


def pick_yomitan_audio_source_url(item):
    for source in decode_yomitan_audio_sources(item):
        if not isinstance(source, dict):
            continue
        url = str(source.get("url", "") or "").strip()
        if url:
            return url
    return ""


def store_yomitan_audio_media(result, args, debug_logger=None):
    stored_filenames = set()
    for item in extract_audio_media(result):
        if not isinstance(item, dict):
            continue
        content = str(item.get("content", "") or "").strip()
        filename = sanitize_filename(item.get("ankiFilename", "") or item.get("filename", ""), "")
        media_type = str(item.get("mediaType", "") or "").strip().lower()
        if not filename or not content:
            continue
        try:
            if media_type and "audio" in media_type:
                store_media_file(filename, content, args.anki_url)
                stored_filenames.add(filename)
                continue
            if media_type == "application/json":
                source_url = pick_yomitan_audio_source_url(item)
                if not source_url:
                    if debug_logger is not None:
                        debug_logger(f"ANKI_FIELDS audioMedia skipped filename='{filename}' reason='missing audio source url'")
                    continue
                source_bytes, content_type = fetch_url_bytes(source_url)
                encoded = base64.b64encode(source_bytes).decode("ascii")
                store_media_file(filename, encoded, args.anki_url)
                stored_filenames.add(filename)
                if debug_logger is not None:
                    debug_logger(
                        "ANKI_FIELDS audioMedia fetched "
                        f"filename='{filename}' source='{source_url}' contentType='{content_type}'"
                    )
                continue
            if debug_logger is not None:
                debug_logger(f"ANKI_FIELDS audioMedia skipped filename='{filename}' mediaType='{media_type or 'unknown'}'")
        except Exception as error:  # noqa: BLE001
            if debug_logger is not None:
                debug_logger(f"ANKI_FIELDS audioMedia failed filename='{filename}' error={error}")
    if debug_logger is not None and stored_filenames:
        debug_logger(f"ANKI_FIELDS audioMedia stored count={len(stored_filenames)}")
    return stored_filenames


def lookup_yomitan_fields_for_payload(payload, args, debug_logger=None):
    term = first_text(
        payload.get("expression"),
        payload.get("term"),
        payload.get("reading"),
    )
    if not term:
        return {}, "", {}

    def safe_debug_log(message):
        if debug_logger is None:
            return
        try:
            debug_logger(message)
        except Exception:
            return

    try:
        raw_result = request_anki_fields_result(args, term)
        extracted_fields = normalize_yomitan_fields(extract_first_anki_fields(raw_result))
        if debug_logger is not None:
            raw_keys = sorted(raw_result.keys()) if isinstance(raw_result, dict) else []
            raw_fields = raw_result.get("fields") if isinstance(raw_result, dict) else None
            first_item = raw_fields[0] if isinstance(raw_fields, list) and raw_fields else None
            extracted_keys = sorted(extracted_fields.keys()) if isinstance(extracted_fields, dict) else []
            safe_debug_log(
                "ANKI_FIELDS debug "
                f"term='{term}' rawType={type(raw_result).__name__} rawKeys={raw_keys} "
                f"fieldsType={type(raw_fields).__name__ if raw_fields is not None else 'None'} "
                f"fieldsLen={len(raw_fields) if isinstance(raw_fields, list) else 0} "
                f"firstItemType={type(first_item).__name__ if first_item is not None else 'None'} "
                f"extractedKeys={extracted_keys}"
            )
            if isinstance(extracted_fields, dict):
                preview_keys = [
                    "expression",
                    "reading",
                    "furigana-plain",
                    "glossary-first",
                    "glossary",
                    "pitch-accent-positions",
                    "frequencies",
                    "frequency-harmonic-rank",
                ]
                preview = {
                    key: shorten_text(extracted_fields.get(key, ""))
                    for key in preview_keys
                    if key in extracted_fields
                }
                safe_debug_log(
                    "ANKI_FIELDS preview "
                    + json.dumps(preview, ensure_ascii=False, separators=(",", ":"))
                )
        return extracted_fields, "", raw_result
    except Exception as error:  # noqa: BLE001
        safe_debug_log(f"ANKI_FIELDS debug failed term='{term}' error={error}")
        return {}, str(error), {}


def extract_lookup_expression(entry):
    if not isinstance(entry, dict):
        return ""
    fields = entry.get("fields")
    if isinstance(fields, dict):
        expression = str(fields.get("expression", "") or "").strip()
        if expression:
            return expression
    expression = str(entry.get("expression", "") or "").strip()
    if expression:
        return expression
    headwords = entry.get("headwords")
    if isinstance(headwords, list):
        for headword in headwords:
            if not isinstance(headword, dict):
                continue
            term = str(headword.get("term", "") or "").strip()
            if term:
                return term
    return ""


def resolve_lookup_at_position(args, text, index):
    source = str(text or "")
    if not source:
        return {"ok": True, "lookupSurface": "", "lookupQuery": "", "result": []}

    try:
        absolute_index = int(index)
    except (TypeError, ValueError):
        raise RuntimeError("index must be an integer")

    if absolute_index < 0 or absolute_index >= len(source):
        return {"ok": True, "lookupSurface": "", "lookupQuery": "", "lookupStart": -1, "lookupEnd": -1, "result": []}
    if not is_japanese_char(source[absolute_index]):
        return {"ok": True, "lookupSurface": "", "lookupQuery": "", "lookupStart": -1, "lookupEnd": -1, "result": []}

    run_start = absolute_index
    while run_start > 0 and is_japanese_char(source[run_start - 1]):
        run_start -= 1
    run_end = absolute_index + 1
    while run_end < len(source) and is_japanese_char(source[run_end]):
        run_end += 1

    run = source[run_start:run_end]
    local_index = absolute_index - run_start
    lookup_cache = {}

    def lookup_surface(surface):
        cached = lookup_cache.get(surface)
        if cached is not None:
            return cached
        try:
            result = request_lookup_result(args, surface)
        except Exception:
            cached = (None, [])
        else:
            cached = (result, extract_lookup_entries(result))
        lookup_cache[surface] = cached
        return cached

    max_backtrack = min(LOOKUP_MAX_BACKTRACK, local_index)
    for backtrack in range(max_backtrack + 1):
        start_local = local_index - backtrack
        matched = None
        max_length = min(LOOKUP_MAX_MATCH_LENGTH, len(run) - start_local)
        for size in range(max_length, 0, -1):
            surface = run[start_local : start_local + size]
            if not surface:
                continue
            result, entries = lookup_surface(surface)
            if not entries:
                continue
            matched = (surface, result, entries)
            break

        if matched is None:
            continue

        surface, result, entries = matched
        end_offset = start_local + len(surface)
        if not (start_local <= local_index < end_offset):
            continue
        query_expression = extract_lookup_expression(entries[0])
        return {
            "ok": True,
            "lookupSurface": surface,
            "lookupQuery": query_expression or surface,
            "lookupStart": run_start + start_local,
            "lookupEnd": run_start + end_offset,
            "result": result,
        }

    return {"ok": True, "lookupSurface": "", "lookupQuery": "", "lookupStart": -1, "lookupEnd": -1, "result": []}


def clip_audio_from_source_url(payload):
    source_audio_url = payload.get("source-audio-url", "") or payload.get("source-audio-backup-url", "")
    if not source_audio_url:
        return "", "", "", ""

    ffmpeg_bin = find_installed_binary(
        "ffmpeg",
        package_glob="yt-dlp.FFmpeg*",
        nested_glob=os.path.join("*", "bin", "ffmpeg.exe"),
    )
    if not ffmpeg_bin:
        return "", "", "", "ffmpeg not found"

    try:
        start_seconds = float(payload.get("clip-start", "") or 0)
        end_seconds = float(payload.get("clip-end", "") or 0)
    except ValueError:
        return "", "", "", "invalid clip time"

    duration_seconds = max(0.05, end_seconds - start_seconds)
    referer = payload.get("source-page-url", "") or ""

    try:
        source_bytes, content_type = fetch_url_bytes(source_audio_url, referer)
    except Exception as error:  # noqa: BLE001
        return "", "", "", f"source fetch failed: {error}"

    input_extension = guess_extension(source_audio_url, content_type, ".m4s")
    output_filename = re.sub(r"\.[A-Za-z0-9]+$", "", build_audio_name(payload)) + ".m4a"

    try:
        with tempfile.TemporaryDirectory(prefix="ankiouo-audio-") as temp_dir:
            input_path = f"{temp_dir}\\source{input_extension}"
            output_path = f"{temp_dir}\\clip.m4a"
            with open(input_path, "wb") as handle:
                handle.write(source_bytes)

            command = [
                ffmpeg_bin,
                "-y",
                "-loglevel",
                "error",
                "-ss",
                f"{start_seconds:.3f}",
                "-t",
                f"{duration_seconds:.3f}",
                "-i",
                input_path,
                "-vn",
                "-acodec",
                "aac",
                "-b:a",
                "128k",
                output_path,
            ]
            subprocess.run(command, check=True, capture_output=True)

            with open(output_path, "rb") as handle:
                output_bytes = handle.read()
    except Exception as error:  # noqa: BLE001
        return "", "", "", f"source clip failed: {error}"

    encoded = base64.b64encode(output_bytes).decode("ascii")
    return output_filename, encoded, "audio/mp4", ""


def clip_audio_with_ytdlp(payload, args):
    source_page_url = str(payload.get("source-page-url", "") or "").strip()
    if not source_page_url:
        return "", "", "", ""

    ffmpeg_bin = find_installed_binary(
        "ffmpeg",
        package_glob="yt-dlp.FFmpeg*",
        nested_glob=os.path.join("*", "bin", "ffmpeg.exe"),
    )
    if not ffmpeg_bin:
        return "", "", "", "ffmpeg not found"

    yt_dlp_bin = (
        shutil.which(args.yt_dlp_bin)
        or shutil.which(f"{args.yt_dlp_bin}.exe")
        or find_installed_binary(
            "yt-dlp",
            package_glob="yt-dlp.yt-dlp*",
            nested_glob="yt-dlp.exe",
        )
        or args.yt_dlp_bin
    )
    if not yt_dlp_bin:
        return "", "", "", "yt-dlp not found"

    try:
        start_seconds = float(payload.get("clip-start", "") or 0)
        end_seconds = float(payload.get("clip-end", "") or 0)
    except ValueError:
        return "", "", "", "invalid clip time"

    duration_seconds = max(0.05, end_seconds - start_seconds)
    output_filename = re.sub(r"\.[A-Za-z0-9]+$", "", build_audio_name(payload)) + ".m4a"

    def run_ytdlp(download_template, with_cookies):
        ytdlp_command = [
            yt_dlp_bin,
            "--no-playlist",
            "--no-warnings",
            "--no-progress",
            "--restrict-filenames",
            "-f",
            "bestaudio/best",
            "-o",
            download_template,
        ]
        if with_cookies and args.yt_dlp_cookies_from_browser:
            ytdlp_command.extend(["--cookies-from-browser", args.yt_dlp_cookies_from_browser])
        ytdlp_command.append(source_page_url)
        subprocess.run(ytdlp_command, check=True, capture_output=True)

    try:
        with tempfile.TemporaryDirectory(prefix="ankiouo-ytdlp-") as temp_dir:
            download_template = os.path.join(temp_dir, "source.%(ext)s")
            used_mode = "no-cookie"
            try:
                if args.yt_dlp_cookies_from_browser:
                    used_mode = f"cookies:{args.yt_dlp_cookies_from_browser}"
                    run_ytdlp(download_template, with_cookies=True)
                else:
                    run_ytdlp(download_template, with_cookies=False)
            except subprocess.CalledProcessError as first_error:
                stderr_text = first_error.stderr.decode("utf-8", errors="replace") if first_error.stderr else ""
                stdout_text = first_error.stdout.decode("utf-8", errors="replace") if first_error.stdout else ""
                details = (stderr_text or stdout_text or "").strip()
                cookie_copy_failed = "could not copy chrome cookie database" in details.lower()
                if args.yt_dlp_cookies_from_browser and cookie_copy_failed:
                    used_mode = "fallback-no-cookie"
                    run_ytdlp(download_template, with_cookies=False)
                else:
                    raise first_error

            candidates = []
            for entry in os.listdir(temp_dir):
                if entry.startswith("source."):
                    full_path = os.path.join(temp_dir, entry)
                    if os.path.isfile(full_path):
                        candidates.append(full_path)
            if not candidates:
                return "", "", "", "yt-dlp download produced no audio file"

            input_path = max(candidates, key=lambda path: os.path.getsize(path))
            output_path = os.path.join(temp_dir, "clip.m4a")
            ffmpeg_command = [
                ffmpeg_bin,
                "-y",
                "-loglevel",
                "error",
                "-ss",
                f"{start_seconds:.3f}",
                "-t",
                f"{duration_seconds:.3f}",
                "-i",
                input_path,
                "-vn",
                "-acodec",
                "aac",
                "-b:a",
                "128k",
                output_path,
            ]
            subprocess.run(ffmpeg_command, check=True, capture_output=True)

            with open(output_path, "rb") as handle:
                output_bytes = handle.read()
    except subprocess.CalledProcessError as error:
        stderr_text = ""
        try:
            stderr_text = error.stderr.decode("utf-8", errors="replace").strip()
        except Exception:  # noqa: BLE001
            stderr_text = ""
        stdout_text = ""
        try:
            stdout_text = error.stdout.decode("utf-8", errors="replace").strip()
        except Exception:  # noqa: BLE001
            stdout_text = ""
        details = stderr_text or stdout_text or str(error)
        return "", "", "", f"yt-dlp clip failed: {details}"
    except Exception as error:  # noqa: BLE001
        return "", "", "", f"yt-dlp clip failed: {error}"

    encoded = base64.b64encode(output_bytes).decode("ascii")
    return output_filename, encoded, "audio/mp4", ""


def build_fields(
    payload,
    audio_field_name,
    picture_field_name,
    audio_reference="",
    expression_audio_reference="",
    picture_reference="",
    yomitan_fields=None,
    yomitan_audio_reference="",
    debug_logger=None,
):
    yomitan_fields = yomitan_fields or {}
    configured_field_map = parse_json_field(payload.get("fieldMap"), {}) or load_saved_field_map() or DEFAULT_FIELD_MAP
    values = build_value_map(
        payload,
        audio_reference,
        expression_audio_reference,
        picture_reference,
        yomitan_fields,
        yomitan_audio_reference,
    )
    if debug_logger is not None:
        value_preview = {
            key: shorten_text(values.get(key, ""))
            for key in (
                "expression",
                "reading",
                "furigana-plain",
                "glossary-first",
                "glossary",
                "pitch-accent-positions",
                "frequencies",
                "frequency-harmonic-rank",
                "audio",
                "sentence",
                "cloze-sentence",
            )
            if key in values
        }
        debug_logger("ANKI_VALUES preview " + json.dumps(value_preview, ensure_ascii=False, separators=(",", ":")))
    fields = build_fields_from_map(configured_field_map, values)
    if not fields:
        raise RuntimeError("Field mapping is empty.")
    return fields


def build_audio_diagnostic(payload, audio_mode, clip_errors, audio_reference):
    source_audio_url = str(payload.get("source-audio-url", "") or "").strip()
    backup_audio_url = str(payload.get("source-audio-backup-url", "") or "").strip()

    diagnostic = {
        "stored": bool(audio_reference),
        "mode": audio_mode,
        "sourceAudioUrlPresent": bool(source_audio_url),
        "sourceAudioBackupUrlPresent": bool(backup_audio_url),
        "clipErrors": [item for item in clip_errors if item],
        "summary": "",
    }

    if audio_mode == "source-clip":
        diagnostic["summary"] = "Audio stored via source clip."
        return diagnostic
    if audio_mode == "ytdlp-clip":
        diagnostic["summary"] = "Audio stored via yt-dlp clip."
        return diagnostic
    reasons = []
    if not source_audio_url:
        reasons.append("missing source-audio-url")
    if diagnostic["clipErrors"]:
        reasons.extend(diagnostic["clipErrors"])
    if not reasons:
        reasons.append("no usable audio source")
    diagnostic["summary"] = "Audio not stored: " + " | ".join(reasons)
    return diagnostic


def add_note_from_payload(payload, args, screenshot_bytes=None, debug_logger=None):
    deck_name = payload.get("deck") or load_saved_default_deck() or args.default_deck
    model_name = payload.get("model") or load_saved_default_model() or args.default_model
    audio_field_name = payload.get("audioField") or "SentenceAudio"
    picture_field_name = payload.get("pictureField") or "Picture"
    ensure_deck(deck_name, args.anki_url)

    audio_filename = build_audio_name(payload)
    image_filename = build_image_name(payload)
    audio_reference = ""
    picture_reference = ""
    audio_mode = "none"
    clip_errors = []

    audio_filename, audio_base64, audio_mime, source_error = clip_audio_from_source_url(payload)
    if audio_base64:
        audio_mode = "source-clip"
    else:
        if source_error:
            clip_errors.append(source_error)
        audio_filename, audio_base64, audio_mime, ytdlp_error = clip_audio_with_ytdlp(payload, args)
        if audio_base64:
            audio_mode = "ytdlp-clip"
        else:
            if ytdlp_error:
                clip_errors.append(ytdlp_error)
            audio_filename = build_audio_name(payload)
            audio_base64 = ""
            audio_mime = payload.get("audio-mime", "") or ""

    if audio_base64:
        store_media_file(audio_filename, audio_base64, args.anki_url)
        audio_reference = f"[sound:{audio_filename}]"

    audio_diagnostic = build_audio_diagnostic(payload, audio_mode, clip_errors, audio_reference)

    if screenshot_bytes:
        image_base64 = base64.b64encode(screenshot_bytes).decode("ascii")
        store_media_file(image_filename, image_base64, args.anki_url)
        picture_reference = f'<img src="{image_filename}">'

    yomitan_fields, yomitan_lookup_error, yomitan_raw_result = lookup_yomitan_fields_for_payload(
        payload,
        args,
        debug_logger=debug_logger,
    )
    stored_yomitan_audio_filenames = store_yomitan_audio_media(
        yomitan_raw_result,
        args,
        debug_logger=debug_logger,
    )
    yomitan_audio_reference = extract_yomitan_audio_reference(
        yomitan_raw_result,
        yomitan_fields,
        payload.get("expression"),
        payload.get("reading"),
        stored_filenames=stored_yomitan_audio_filenames,
    )

    fields = build_fields(
        payload,
        audio_field_name,
        picture_field_name,
        audio_reference,
        "",
        picture_reference,
        yomitan_fields,
        yomitan_audio_reference,
        debug_logger=debug_logger,
    )
    duplicate_notes = []
    duplicate_check_value = str(payload.get("duplicateCheck") or "").strip().lower()
    duplicate_check = (
        duplicate_check_value in {"1", "true", "yes", "on"}
        if duplicate_check_value
        else load_saved_duplicate_check()
    )
    if duplicate_check:
        duplicate_notes = find_duplicate_notes(payload, fields, args)
        if duplicate_notes:
            return {
                "ok": False,
                "duplicate": True,
                "duplicateNotes": duplicate_notes,
                "deck": deck_name,
                "model": model_name,
                "audioMode": audio_mode,
                "audioClipError": " | ".join([item for item in clip_errors if item]),
                "audioDiagnostic": audio_diagnostic,
                "yomitanLookupError": yomitan_lookup_error,
                "yomitanLookupUsed": bool(yomitan_fields),
                "audioStored": bool(audio_reference),
                "imageStored": bool(picture_reference),
                "error": f"Duplicate note found: {duplicate_notes[0]}",
            }

    note_tags = parse_note_tags(payload.get("noteTags")) or load_saved_default_tags()

    note = {
        "deckName": deck_name,
        "modelName": model_name,
        "fields": fields,
        "options": {"allowDuplicate": not duplicate_check},
        "tags": note_tags,
    }
    note_id = invoke_anki("addNote", {"note": note}, args.anki_url)
    return {
        "ok": True,
        "noteId": note_id,
        "deck": deck_name,
        "model": model_name,
        "audioMode": audio_mode,
        "audioClipError": " | ".join([item for item in clip_errors if item]),
        "audioDiagnostic": audio_diagnostic,
        "yomitanLookupError": yomitan_lookup_error,
        "yomitanLookupUsed": bool(yomitan_fields),
        "audioStored": bool(audio_reference),
        "imageStored": bool(picture_reference),
    }


def build_handler(args):
    last_import_error = {"message": ""}

    def log_line(message):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{timestamp}] {message}"
        emit_log(line, args.log_file)

    def parse_multipart_form_data(content_type_header, raw_bytes):
        binary_field_defaults = {
            "screenshot-binary": "screenshot.jpg",
        }

        boundary_match = re.search(r'boundary="?([^";]+)"?', content_type_header, flags=re.IGNORECASE)
        boundary = boundary_match.group(1).encode("utf-8") if boundary_match else b""
        if not boundary:
            raise ValueError("multipart boundary is missing")

        fields = {}
        files = {}
        boundary_token = b"--" + boundary

        chunks = raw_bytes.split(boundary_token)
        for chunk in chunks:
            if not chunk:
                continue
            part = chunk.strip()
            if not part or part == b"--":
                continue
            if part.endswith(b"--"):
                part = part[:-2].rstrip()
            if not part:
                continue

            header_blob, sep, body = part.partition(b"\r\n\r\n")
            if not sep:
                header_blob, sep, body = part.partition(b"\n\n")
            if not sep:
                continue

            header_text = header_blob.decode("utf-8", errors="replace")
            body = body.rstrip(b"\r\n")

            content_disposition = ""
            content_type = ""
            for raw_line in header_text.replace("\r\n", "\n").split("\n"):
                line = raw_line.strip()
                if not line:
                    continue
                lower_line = line.lower()
                if lower_line.startswith("content-disposition:"):
                    content_disposition = line[len("content-disposition:") :].strip()
                elif lower_line.startswith("content-type:"):
                    content_type = line[len("content-type:") :].strip()

            if "form-data" not in content_disposition.lower():
                continue

            name_match = re.search(r'name="([^"]+)"', content_disposition)
            if not name_match:
                name_match = re.search(r"name=([^;\\s]+)", content_disposition)
            if not name_match:
                continue
            name = name_match.group(1).strip().strip('"')

            filename_match = re.search(r'filename="([^"]*)"', content_disposition)
            if not filename_match:
                filename_match = re.search(r"filename=([^;\\s]+)", content_disposition)
            filename = filename_match.group(1).strip().strip('"') if filename_match else ""

            is_binary_field = name in binary_field_defaults
            if filename or is_binary_field:
                files[name] = {
                    "filename": filename or binary_field_defaults.get(name, ""),
                    "content_type": content_type,
                    "data": body,
                }
            else:
                fields[name] = body.decode("utf-8", errors="replace")

        if not fields and not files:
            raise ValueError("multipart payload parse failed")
        return fields, files

    class Handler(BaseHTTPRequestHandler):
        def _send_html(self, status_code, body):
            content = body.encode("utf-8")
            try:
                self.send_response(status_code)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, X-VouoA-Jimaku-Key")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.end_headers()
                self.wfile.write(content)
                return True
            except Exception as error:  # noqa: BLE001
                if not is_client_disconnect_error(error):
                    raise
                return False

        def _send_json(self, status_code, payload):
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            try:
                self.send_response(status_code)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, X-VouoA-Jimaku-Key")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.end_headers()
                self.wfile.write(body)
                return True
            except Exception as error:  # noqa: BLE001
                if not is_client_disconnect_error(error):
                    raise
                return False

        def do_OPTIONS(self):
            self._send_ok()

        def _send_ok(self, payload=None):
            body = {"ok": True}
            if payload:
                body.update(payload)
            return self._send_json(200, body)

        def _send_error(self, status_code, error):
            return self._send_json(status_code, {"ok": False, "error": str(error)})

        def _query_params(self):
            parsed = urllib.parse.urlparse(self.path)
            return parsed, urllib.parse.parse_qs(parsed.query)

        def _query_value(self, query, name, default=""):
            return str((query.get(name) or [default])[0] or "").strip()

        def _read_json_body(self):
            length = int(self.headers.get("Content-Length", "0"))
            raw_bytes = self.rfile.read(length)
            return json.loads(raw_bytes.decode("utf-8") or "{}")

        def _proxy_yomitan_json(self, path):
            try:
                payload = self._read_json_body()
                if path == "/ankiFields":
                    term = first_text(
                        payload.get("term"),
                        payload.get("expression"),
                    )
                    has_explicit_field_payload = isinstance(payload, dict) and (
                        "markers" in payload
                        or "mode" in payload
                        or "text" in payload
                        or "dictionaryEntry" in payload
                        or "dictionaryEntries" in payload
                    )
                    raw_result = {}
                    if term and not has_explicit_field_payload:
                        raw_result = request_anki_fields_result(args, term)
                    else:
                        raw_result = yomitan_api_request(
                            args,
                            path,
                            payload,
                            timeout_seconds=YOMITAN_ANKI_FIELDS_TIMEOUT_SECONDS,
                        )
                        if not raw_result and term:
                            raw_result = request_anki_fields_result(args, term)
                    result = normalize_yomitan_fields(raw_result)
                else:
                    result = yomitan_api_request(args, path, payload)
                self._send_ok({"result": result})
            except Exception as error:
                self._send_error(500, error)

        def do_GET(self):
            if self.path.startswith("/health"):
                self._send_ok({"service": "anki-bridge"})
                return
            if self.path.startswith("/last-import-error"):
                self._send_ok({"error": last_import_error["message"]})
                return
            if self.path.startswith("/lookup"):
                _parsed, query = self._query_params()
                term = self._query_value(query, "term")
                if not term:
                    self._send_error(400, "Missing required query parameter: term")
                    return
                try:
                    result = request_lookup_result(args, term)
                    self._send_ok({"term": term, "result": result})
                except Exception as error:
                    self._send_error(500, error)
                return
            if self.path.startswith("/yomitan/serverVersion"):
                try:
                    result = yomitan_api_request(args, "/serverVersion", {})
                    self._send_ok({"result": result})
                except Exception as error:
                    self._send_error(500, error)
                return
            if self.path.startswith("/yomitan/yomitanVersion"):
                try:
                    result = yomitan_api_request(args, "/yomitanVersion", {})
                    self._send_ok({"result": result})
                except Exception as error:
                    self._send_error(500, error)
                return
            if self.path.startswith("/probe-ytdlp"):
                yt_dlp_bin = (
                    shutil.which(args.yt_dlp_bin)
                    or shutil.which(f"{args.yt_dlp_bin}.exe")
                    or find_installed_binary(
                        "yt-dlp",
                        package_glob="yt-dlp.yt-dlp*",
                        nested_glob="yt-dlp.exe",
                    )
                    or ""
                )
                ffmpeg_bin = (
                    find_installed_binary(
                        "ffmpeg",
                        package_glob="yt-dlp.FFmpeg*",
                        nested_glob=os.path.join("*", "bin", "ffmpeg.exe"),
                    )
                    or ""
                )
                _parsed, query = self._query_params()
                target_url = self._query_value(query, "url")
                payload = {
                    "ok": bool(yt_dlp_bin and ffmpeg_bin),
                    "ytDlpFound": bool(yt_dlp_bin),
                    "ffmpegFound": bool(ffmpeg_bin),
                    "ytDlpBin": yt_dlp_bin,
                    "ffmpegBin": ffmpeg_bin,
                    "cookiesFromBrowser": args.yt_dlp_cookies_from_browser or "",
                }
                if target_url and yt_dlp_bin:
                    command = [
                        yt_dlp_bin,
                        "--simulate",
                        "--skip-download",
                        "--no-playlist",
                        "--no-warnings",
                        "--no-progress",
                    ]
                    if args.yt_dlp_cookies_from_browser:
                        command.extend(["--cookies-from-browser", args.yt_dlp_cookies_from_browser])
                    command.append(target_url)
                    try:
                        subprocess.run(command, check=True, capture_output=True)
                        payload["probeOk"] = True
                    except subprocess.CalledProcessError as error:
                        payload["ok"] = False
                        payload["probeOk"] = False
                        payload["probeError"] = (
                            error.stderr.decode("utf-8", errors="replace").strip()
                            or error.stdout.decode("utf-8", errors="replace").strip()
                            or str(error)
                        )
                self._send_json(200, payload)
                return
            if self.path.startswith("/decks"):
                try:
                    decks = invoke_anki("deckNames", anki_url=args.anki_url)
                    self._send_ok({"decks": decks})
                except Exception as error:
                    self._send_error(500, error)
                return
            if self.path.startswith("/anki/decks"):
                try:
                    decks = invoke_anki("deckNames", anki_url=args.anki_url)
                    self._send_ok({"decks": decks})
                except Exception as error:
                    self._send_error(500, error)
                return
            if self.path.startswith("/anki/models"):
                try:
                    models = invoke_anki("modelNames", anki_url=args.anki_url)
                    self._send_ok({"models": models})
                except Exception as error:
                    self._send_error(500, error)
                return
            if self.path.startswith("/anki/model-fields"):
                _parsed, query = self._query_params()
                model_name = self._query_value(query, "model")
                if not model_name:
                    self._send_error(400, "Missing required query parameter: model")
                    return
                try:
                    fields = invoke_anki("modelFieldNames", {"modelName": model_name}, args.anki_url)
                    self._send_ok({"model": model_name, "fields": fields})
                except Exception as error:
                    self._send_error(500, error)
                return
            self._send_error(404, "Not found")

        def do_POST(self):
            if self.path.startswith("/yomitan/termEntries"):
                self._proxy_yomitan_json("/termEntries")
                return

            if self.path.startswith("/yomitan/kanjiEntries"):
                self._proxy_yomitan_json("/kanjiEntries")
                return

            if self.path.startswith("/yomitan/tokenize"):
                self._proxy_yomitan_json("/tokenize")
                return

            if self.path.startswith("/yomitan/ankiFields"):
                self._proxy_yomitan_json("/ankiFields")
                return

            if self.path.startswith("/lookup-at"):
                try:
                    payload = self._read_json_body()
                    result = resolve_lookup_at_position(
                        args,
                        payload.get("text", ""),
                        payload.get("index", -1),
                    )
                    self._send_json(200, result)
                except Exception as error:
                    self._send_error(500, error)
                return

            if not self.path.startswith("/import"):
                self._send_error(404, "Not found")
                return

            started = time.time()
            client = f"{self.client_address[0]}:{self.client_address[1]}"
            try:
                content_type_header = self.headers.get("Content-Type") or ""
                main_type = content_type_header.split(";", 1)[0].lower().strip()
                if main_type != "multipart/form-data":
                    log_line(f"IMPORT rejected (unsupported content-type) from {client}: {main_type or '(empty)'}")
                    self._send_error(415, "Only multipart/form-data is supported.")
                    return

                length = int(self.headers.get("Content-Length", "0"))
                raw_bytes = self.rfile.read(length)
                payload, files = parse_multipart_form_data(content_type_header, raw_bytes)

                image_file = files.get("screenshot-binary")
                image_size = 0
                if image_file and image_file.get("data"):
                    image_size = len(image_file["data"])
                    payload["screenshot-file"] = sanitize_filename(
                        image_file.get("filename") or payload.get("screenshot-file"),
                        "screenshot.jpg",
                    )
                    payload["screenshot-mime"] = image_file.get("content_type") or payload.get("screenshot-mime", "")

                if not image_size:
                    client_build = str(payload.get("client-build", "") or "")
                    log_line(
                        f"IMPORT media-empty debug contentType='{content_type_header}' "
                        f"contentLength={length} clientBuild='{client_build}' "
                        f"fields={sorted(list(payload.keys()))} files={sorted(list(files.keys()))}"
                    )

                expression = str(payload.get("expression", "") or "")
                reading = str(payload.get("reading", "") or "")
                log_line(
                    f"IMPORT recv from {client} expr='{expression}' reading='{reading}'"
                )

                result = add_note_from_payload(
                    payload,
                    args,
                    screenshot_bytes=image_file.get("data") if image_file else None,
                    debug_logger=log_line,
                )
                last_import_error["message"] = ""
                elapsed_ms = int((time.time() - started) * 1000)
                audio_clip_error = str(result.get("audioClipError", "") or "").strip()
                error_suffix = f" audioClipError='{audio_clip_error}'" if audio_clip_error else ""
                audio_diagnostic = result.get("audioDiagnostic") or {}
                diagnostic_suffix = ""
                if audio_diagnostic:
                    diagnostic_suffix = (
                        " audioDiagnostic="
                        + json.dumps(audio_diagnostic, ensure_ascii=False, separators=(",", ":"))
                    )
                log_line(
                    f"IMPORT ok noteId={result.get('noteId', '')} deck='{result.get('deck', '')}' "
                    f"audioStored={bool(result.get('audioStored'))} imageStored={bool(result.get('imageStored'))} "
                    f"audioMode='{result.get('audioMode', '')}' elapsed={elapsed_ms}ms"
                    f"{error_suffix}{diagnostic_suffix}"
                )
                sent = self._send_json(200, result)
                if not sent:
                    log_line(f"IMPORT response dropped: client disconnected ({client})")
            except Exception as error:
                elapsed_ms = int((time.time() - started) * 1000)
                last_import_error["message"] = str(error)
                log_line(f"IMPORT failed from {client} elapsed={elapsed_ms}ms error={error}")
                try:
                    sent = self._send_error(500, error)
                    if not sent:
                        log_line(f"IMPORT error response dropped: client disconnected ({client})")
                except Exception:
                    pass

        def log_message(self, format, *args):
            return

    return Handler


def main():
    args = parse_args()
    if not args.log_file:
        args.log_file = os.path.join(runtime_dir(), "anki_bridge.log")

    saved_deck = load_saved_default_deck()
    if not args.default_deck:
        args.default_deck = saved_deck or DEFAULT_DECK

    if args.select_deck_on_start:
        if saved_deck and not args.reselect_deck:
            args.default_deck = saved_deck
            emit_log(f"Using saved deck: {args.default_deck}", args.log_file)
        else:
            selected = choose_deck_on_start(args)
            if selected:
                save_saved_default_deck(selected)
    elif args.default_deck:
        save_saved_default_deck(args.default_deck)

    server = ThreadingHTTPServer((args.host, args.port), build_handler(args))
    emit_log(f"Anki bridge listening on http://{args.host}:{args.port}/import", args.log_file)
    emit_log(f"Health check: http://{args.host}:{args.port}/health", args.log_file)
    emit_log(f"Deck list: http://{args.host}:{args.port}/decks", args.log_file)
    emit_log(f"Yomitan API base: {args.yomitan_api_url}", args.log_file)
    emit_log(f"Lookup proxy: http://{args.host}:{args.port}/lookup?term=食べる", args.log_file)
    server.serve_forever()


if __name__ == "__main__":
    main()
