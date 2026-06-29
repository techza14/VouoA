const EXTENSION_API =
  typeof browser !== "undefined"
    ? browser
    : typeof chrome !== "undefined"
      ? chrome
      : null;
const DESKTOP_REQUEST_TIMEOUT_MS = 8000;
const JIMAKU_API_BASE = "https://jimaku.cc";

function buildJimakuApiUrl(path, query = {}) {
  const normalizedPath = `/${String(path || "").replace(/^\/+/, "")}`;
  const url = new URL(normalizedPath, JIMAKU_API_BASE);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value != null && String(value) !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function requireJimakuApiKey(apiKey) {
  const normalized = String(apiKey || "").trim();
  if (!normalized) {
    throw new Error("Jimaku API key is not configured in the plugin.");
  }
  return normalized;
}

function ensureJimakuUrl(url) {
  const target = new URL(String(url || ""), JIMAKU_API_BASE);
  if (target.protocol !== "https:" || !["jimaku.cc", "www.jimaku.cc"].includes(target.hostname)) {
    throw new Error("Refusing non-Jimaku URL.");
  }
  return target.toString();
}

function decodeSubtitleText(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const utf8 = new TextDecoder("utf-8", { fatal: false });
  const shiftJis = typeof TextDecoder !== "undefined" ? new TextDecoder("shift_jis", { fatal: false }) : null;
  const cp932 = typeof TextDecoder !== "undefined" ? new TextDecoder("shift_jis", { fatal: false }) : null;
  const candidates = [utf8, shiftJis, cp932].filter(Boolean);
  for (const decoder of candidates) {
    try {
      const text = decoder.decode(bytes);
      if (text) return text.replace(/^\uFEFF/, "");
    } catch (error) {}
  }
  return utf8.decode(bytes).replace(/^\uFEFF/, "");
}

function dataUrlToBlob(dataUrl, fallbackMime = "application/octet-stream") {
  const source = String(dataUrl || "");
  const parts = source.split(",");
  if (parts.length < 2) {
    return new Blob([], { type: fallbackMime });
  }

  const header = parts[0] || "";
  const mimeMatch = header.match(/^data:([^;]+);base64$/i);
  const mimeType = (mimeMatch && mimeMatch[1]) || fallbackMime;
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

async function sendToDesktopAnkiServer(message) {
  const payload = message.payload || {};
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, String(value == null ? "" : value));
  });

  if (message.screenshotDataUrl) {
    const imageName = payload["screenshot-file"] || "screenshot.jpg";
    const imageBlob = dataUrlToBlob(message.screenshotDataUrl, "image/jpeg");
    formData.append("screenshot-binary", imageBlob, imageName);
  }

  const response = await fetchWithTimeout(message.url, {
    method: "POST",
    body: formData
  }, Number(message.timeoutMs || 30000));

  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (error) {
    data = null;
  }

  if (!response.ok || (data && data.ok === false)) {
    return {
      ok: false,
      error: (data && (data.error || data.message)) || `HTTP ${response.status}`,
      data
    };
  }

  return {
    ok: true,
    data: data || { ok: true }
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DESKTOP_REQUEST_TIMEOUT_MS) {
  if (typeof AbortController === "undefined") {
    return Promise.race([
      fetch(url, options),
      new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error(`request timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: options.signal || controller.signal
    });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error(`request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchDesktopBridgeJson(message) {
  const method = String(message.method || "GET").toUpperCase();
  const fetchOptions = {
    method,
    headers: message.headers || {}
  };

  if (method !== "GET" && method !== "HEAD" && message.body != null) {
    fetchOptions.body = String(message.body);
  }

  const response = await fetchWithTimeout(message.url, fetchOptions, Number(message.timeoutMs || DESKTOP_REQUEST_TIMEOUT_MS));
  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: (data && (data.error || data.message)) || rawText || `HTTP ${response.status}`
    };
  }

  return {
    ok: true,
    status: response.status,
    data: data || {}
  };
}

async function fetchJimakuApi(message) {
  const apiKey = requireJimakuApiKey(message.apiKey);
  const url = buildJimakuApiUrl(message.path, message.query || {});
  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: apiKey
      }
    },
    Number(message.timeoutMs || DESKTOP_REQUEST_TIMEOUT_MS)
  );
  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (error) {
    data = null;
  }
  if (!response.ok) {
    throw new Error((data && (data.error || data.message)) || rawText || `HTTP ${response.status}`);
  }
  return {
    ok: true,
    status: response.status,
    data: data || {}
  };
}

async function fetchJimakuSubtitle(message) {
  const apiKey = requireJimakuApiKey(message.apiKey);
  const name = String(message.name || "");
  if (!/\.(srt|ass|ssa)$/i.test(name)) {
    throw new Error("Unsupported Jimaku subtitle type.");
  }
  const url = ensureJimakuUrl(message.url);
  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        Authorization: apiKey
      }
    },
    Number(message.timeoutMs || 30000)
  );
  const buffer = await response.arrayBuffer();
  if (!response.ok) {
    const text = decodeSubtitleText(buffer);
    throw new Error(text || `HTTP ${response.status}`);
  }
  return {
    ok: true,
    status: response.status,
    data: {
      subtitle: {
        name,
        format: (name.split(".").pop() || "").toLowerCase(),
        size: buffer.byteLength,
        text: decodeSubtitleText(buffer)
      }
    }
  };
}

if (EXTENSION_API && EXTENSION_API.runtime && EXTENSION_API.runtime.onMessage) {
  EXTENSION_API.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) {
      return false;
    }

    (async () => {
      try {
        switch (message.type) {
          case "fetchDesktopBridgeJson":
            sendResponse(await fetchDesktopBridgeJson(message));
            return;
          case "fetchJimakuApi":
            sendResponse(await fetchJimakuApi(message));
            return;
          case "fetchJimakuSubtitle":
            sendResponse(await fetchJimakuSubtitle(message));
            return;
          case "sendToDesktopAnkiServer":
            sendResponse(await sendToDesktopAnkiServer(message));
            return;
          default:
            sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
        }
      } catch (error) {
        sendResponse({
          ok: false,
          error: error && error.message ? error.message : String(error)
        });
      }
    })();

    return true;
  });
}

if (EXTENSION_API && EXTENSION_API.action && EXTENSION_API.action.onClicked) {
  EXTENSION_API.action.onClicked.addListener(async (tab) => {
    try {
      if (!tab || typeof tab.id !== "number") {
        return;
      }
      await EXTENSION_API.tabs.sendMessage(tab.id, { type: "ankiouoTogglePanel" });
    } catch (error) {}
  });
}
