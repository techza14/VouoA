import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BRIDGE_PATH = ROOT / "tools" / "anki_bridge_server.py"


def load_bridge_module():
    spec = importlib.util.spec_from_file_location("anki_bridge_server", BRIDGE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def assert_equal(actual, expected, label):
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


def assert_true(value, label):
    if not value:
        raise AssertionError(label)


def assert_raises(callback, label):
    try:
        callback()
    except Exception:
        return
    raise AssertionError(f"{label}: expected exception")


def main():
    bridge = load_bridge_module()

    payload = bridge.build_lookup_payload("食べる")
    assert_equal(payload["text"], "食べる", "lookup text")
    assert_true("glossary" in payload["markers"], "lookup markers include glossary")
    assert_true("frequencies" in payload["markers"], "lookup markers include frequencies")

    rendered = bridge.render_template("{expression} / {reading}", {"expression": "読む", "reading": "よむ"})
    assert_equal(rendered, "読む / よむ", "template rendering")

    field_map = bridge.load_saved_field_map()
    assert_true(isinstance(field_map, dict), "saved field map returns dict")

    default_fields = bridge.build_fields(
        {
            "expression": "読む",
            "reading": "よむ",
            "glossary-first": "to read",
            "glossary": "to read",
        },
        "SentenceAudio",
        "Picture",
    )
    assert_equal(default_fields.get("Expression"), "読む", "default field map expression")
    assert_equal(default_fields.get("ExpressionReading"), "よむ", "default field map reading")
    assert_equal(default_fields.get("MainDefinition"), "to read", "default field map main definition")

    print("smoke ok")


if __name__ == "__main__":
    main()
