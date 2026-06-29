const invoke = window.__TAURI__?.core?.invoke;

const state = {
  config: null,
  valueOptions: [],
  decks: [],
  models: [],
  modelFields: [],
  mappingOpen: false,
  ankiSyncInFlight: null,
  saveTimer: null,
  bridgeBootstrapTried: false,
};

const I18N = {
  en: {
    settingsTitle: "Anki Settings",
    defaultDeck: "Deck",
    defaultModel: "Note Type",
    defaultTags: "Tags",
    defaultTagsPlaceholder: "Comma or space separated, e.g. VouoA",
    language: "Language",
    duplicateTitle: "Duplicate Check",
    duplicateDesc: "Check existing notes with AnkiConnect before adding",
    ready: "Ready",
    saved: "Saved",
    fieldMapping: "Field Mapping",
    expand: "Expand",
    collapse: "Collapse",
    lapisDefaults: "Use Default Lapis Mapping",
    mappingEmpty: "Connect AnkiConnect and choose a note type first.",
    mappingCustomPlaceholder: "",
    confirmApplyLapis: "Replace the current field mapping with the Lapis mapping?",
    bridgeControl: "Bridge Control",
    runtimeTitle: "Runtime Status",
    start: "Start",
    stop: "Stop",
    restart: "Restart",
    bridgeLabel: "Bridge",
    ankiLabel: "AnkiConnect",
    yomitanLabel: "Yomitan API",
    bindAddress: "Bind Address",
    importErrorTitle: "Last Import Error",
    audioStatusTitle: "Latest Audio Status",
    recentActivity: "Recent Activity",
    deckPlaceholder: "Select deck",
    modelPlaceholder: "Select note type",
    notChecked: "Not checked",
    bridgeConnected: "Bridge Online",
    bridgeDisconnected: "Bridge Offline",
    ankiConnected: "AnkiConnect Connected",
    ankiDisconnected: "AnkiConnect Disconnected",
    ankiUnchecked: "AnkiConnect Not Checked",
    yomitanConnected: "Yomitan API Connected",
    yomitanDisconnected: "Yomitan API Disconnected",
    yomitanUnchecked: "Yomitan API Not Checked",
    noActivity: "No activity yet.",
    saveFailed: "Save failed: {error}",
    syncFailed: "Failed to sync Anki: {error}",
    snapshotFailed: "Failed to read status: {error}",
    actionFailed: "Action failed: {error}",
    bridgeAutostartFailed: "Failed to auto-start bridge: {error}",
    fieldsFailed: "Failed to load fields: {error}",
    initFailed: "Initialization failed: {error}",
  },
  "zh-CN": {
    settingsTitle: "Anki 设置",
    defaultDeck: "牌组",
    defaultModel: "笔记类型",
    defaultTags: "标签",
    defaultTagsPlaceholder: "可用逗号或空格分隔，例如 VouoA",
    language: "语言",
    duplicateTitle: "重复检查",
    duplicateDesc: "添加前先用 AnkiConnect 查重",
    ready: "准备就绪",
    saved: "已保存",
    fieldMapping: "字段映射",
    expand: "展开",
    collapse: "收起",
    lapisDefaults: "使用默认 Lapis 映射",
    mappingEmpty: "先连接 AnkiConnect 并选择笔记类型。",
    mappingCustomPlaceholder: "",
    confirmApplyLapis: "要用 Lapis 映射覆盖当前字段映射吗？",
    bridgeControl: "Bridge Control",
    runtimeTitle: "运行状态",
    start: "启动",
    stop: "停止",
    restart: "重启",
    bridgeLabel: "Bridge",
    ankiLabel: "AnkiConnect",
    yomitanLabel: "Yomitan API",
    bindAddress: "监听地址",
    importErrorTitle: "最后导入错误",
    audioStatusTitle: "最近音频状态",
    recentActivity: "最近活动",
    deckPlaceholder: "选择牌组",
    modelPlaceholder: "选择笔记类型",
    notChecked: "未检测",
    bridgeConnected: "bridge 在线",
    bridgeDisconnected: "bridge 离线",
    ankiConnected: "AnkiConnect 已连接",
    ankiDisconnected: "AnkiConnect 未连接",
    ankiUnchecked: "AnkiConnect 未检测",
    yomitanConnected: "Yomitan API 已连接",
    yomitanDisconnected: "Yomitan API 未连接",
    yomitanUnchecked: "Yomitan API 未检测",
    noActivity: "还没有活动记录。",
    saveFailed: "保存失败: {error}",
    syncFailed: "同步 Anki 失败: {error}",
    snapshotFailed: "读取状态失败: {error}",
    actionFailed: "操作失败: {error}",
    bridgeAutostartFailed: "自动启动 bridge 失败: {error}",
    fieldsFailed: "读取字段失败: {error}",
    initFailed: "初始化失败: {error}",
  },
};

const elements = {
  deckSelect: document.querySelector("#deck-select"),
  modelSelect: document.querySelector("#model-select"),
  defaultTagsInput: document.querySelector("#default-tags-input"),
  languageSelect: document.querySelector("#language-select"),
  duplicateCheck: document.querySelector("#duplicate-check"),
  saveState: document.querySelector("#save-state"),
  toggleMapping: document.querySelector("#toggle-mapping"),
  mappingChevron: document.querySelector("#mapping-chevron"),
  mappingPanel: document.querySelector("#mapping-panel"),
  mappingEmpty: document.querySelector("#mapping-empty"),
  mappingGrid: document.querySelector("#mapping-grid"),
  applyLapis: document.querySelector("#apply-lapis"),
  bridgeStatus: document.querySelector("#bridge-status"),
  bridgeDetail: document.querySelector("#bridge-detail"),
  ankiStatus: document.querySelector("#anki-status"),
  ankiDetail: document.querySelector("#anki-detail"),
  yomitanStatus: document.querySelector("#yomitan-status"),
  yomitanDetail: document.querySelector("#yomitan-detail"),
  bindStatus: document.querySelector("#bind-status"),
  configPath: document.querySelector("#config-path"),
  launchTarget: document.querySelector("#launch-target"),
  importErrorCard: document.querySelector("#import-error-card"),
  importErrorDetail: document.querySelector("#import-error-detail"),
  audioStatusCard: document.querySelector("#audio-status-card"),
  audioStatusLabel: document.querySelector("#audio-status-label"),
  audioStatusDetail: document.querySelector("#audio-status-detail"),
  recentLogs: document.querySelector("#recent-logs"),
  startBridge: document.querySelector("#start-bridge"),
  stopBridge: document.querySelector("#stop-bridge"),
  restartBridge: document.querySelector("#restart-bridge"),
};

function currentLanguage() {
  const language = String(state.config?.language || "en");
  return Object.prototype.hasOwnProperty.call(I18N, language) ? language : "en";
}

function t(key, params = {}) {
  const table = I18N[currentLanguage()] || I18N.en;
  const template = table[key] ?? I18N.en[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, token) => String(params[token] ?? ""));
}

const LAPIS_FIELD_MAP = {
  Expression: "{expression}",
  ExpressionAudio: "{audio}",
  ExpressionFurigana: "{furigana-plain}",
  ExpressionReading: "{reading}",
  MainDefinition: "{glossary-first}",
  Sentence: "{cloze-prefix}<b>{cloze-body}</b>{cloze-suffix}",
  SentenceAudio: "{cut-audio}",
  Picture: "{picture}",
  Glossary: "{glossary}",
  IsClickCard: "x",
  PitchPosition: "{pitch-accent-positions}",
  Frequency: "{frequencies}",
  FreqSort: "{frequency-harmonic-rank}",
};

function setSaveState(message, isError = false) {
  if (!elements.saveState) return;
  elements.saveState.textContent = message;
  elements.saveState.classList.toggle("error", isError);
}

function flashSavedState(message = t("saved")) {
  setSaveState(message, false);
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => {
    setSaveState(t("ready"), false);
  }, 1400);
}

async function call(command, payload = {}) {
  if (!invoke) {
    throw new Error("Tauri invoke is not available.");
  }
  return invoke(command, payload);
}

function ensureConfig() {
  if (!state.config) {
    state.config = {
      default_deck: "Default",
      default_model: "Lapis",
      default_tags: "VouoA",
      language: "en",
      duplicate_check: false,
      field_map: { ...LAPIS_FIELD_MAP },
    };
  }
  if (!state.config.field_map || typeof state.config.field_map !== "object") {
    state.config.field_map = {};
  }
  return state.config;
}

function updateSelect(select, values, selectedValue, placeholder) {
  if (!select) return;
  select.innerHTML = "";
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  select.appendChild(placeholderOption);
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = value === selectedValue;
    select.appendChild(option);
  }
  if (!selectedValue) {
    placeholderOption.selected = true;
  }
}

function renderText() {
  document.documentElement.lang = currentLanguage();
  const textMap = {
    "title-settings": t("settingsTitle"),
    "label-default-deck": t("defaultDeck"),
    "label-default-model": t("defaultModel"),
    "label-default-tags": t("defaultTags"),
    "label-language": t("language"),
    "duplicate-title": t("duplicateTitle"),
    "duplicate-desc": t("duplicateDesc"),
    "mapping-label": t("fieldMapping"),
    "apply-lapis": t("lapisDefaults"),
    "mapping-empty": t("mappingEmpty"),
    "eyebrow-bridge-control": t("bridgeControl"),
    "title-runtime": t("runtimeTitle"),
    "start-bridge": t("start"),
    "stop-bridge": t("stop"),
    "restart-bridge": t("restart"),
    "label-bridge": t("bridgeLabel"),
    "label-anki": t("ankiLabel"),
    "label-yomitan": t("yomitanLabel"),
    "label-bind": t("bindAddress"),
    "title-import-error": t("importErrorTitle"),
    "title-audio-status": t("audioStatusTitle"),
    "title-recent-activity": t("recentActivity"),
  };
  for (const [id, value] of Object.entries(textMap)) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }
  if (elements.mappingChevron) {
    elements.mappingChevron.textContent = state.mappingOpen ? t("collapse") : t("expand");
  }
}

function renderStaticConfig() {
  const config = ensureConfig();
  renderText();
  updateSelect(elements.deckSelect, state.decks, config.default_deck, t("deckPlaceholder"));
  updateSelect(elements.modelSelect, state.models, config.default_model, t("modelPlaceholder"));
  if (elements.defaultTagsInput) {
    elements.defaultTagsInput.value = String(config.default_tags || "");
    elements.defaultTagsInput.placeholder = t("defaultTagsPlaceholder");
  }
  if (elements.languageSelect) {
    elements.languageSelect.value = currentLanguage();
  }
  if (elements.duplicateCheck) {
    elements.duplicateCheck.checked = !!config.duplicate_check;
  }
  renderMappingPanel();
}

function renderProbe(strong, detail, probe, fallbackLabel) {
  if (strong) {
    strong.textContent = probe?.label || fallbackLabel;
    strong.classList.toggle("ok", !!probe?.ok);
    strong.classList.toggle("bad", probe ? !probe.ok : false);
  }
  if (detail) {
    detail.textContent = probe?.detail || "";
  }
}

function localizeProbeLabel(kind, probe, fallbackLabel) {
  const code = String(probe?.code || "").trim();
  if (kind === "bridge") {
    if (code === "connected") return t("bridgeConnected");
    if (code === "disconnected") return t("bridgeDisconnected");
  }
  if (kind === "anki") {
    if (code === "connected") return t("ankiConnected");
    if (code === "disconnected") return t("ankiDisconnected");
    if (code === "unchecked") return t("ankiUnchecked");
  }
  if (kind === "yomitan") {
    if (code === "connected") return t("yomitanConnected");
    if (code === "disconnected") return t("yomitanDisconnected");
    if (code === "unchecked") return t("yomitanUnchecked");
  }
  return probe?.label || fallbackLabel;
}

function renderStatus(snapshot) {
  const status = snapshot.status;
  renderProbe(
    elements.bridgeStatus,
    elements.bridgeDetail,
    status.bridge ? { ...status.bridge, label: localizeProbeLabel("bridge", status.bridge, t("notChecked")) } : status.bridge,
    t("notChecked")
  );
  renderProbe(
    elements.ankiStatus,
    elements.ankiDetail,
    status.anki_connect ? { ...status.anki_connect, label: localizeProbeLabel("anki", status.anki_connect, t("notChecked")) } : status.anki_connect,
    t("notChecked")
  );
  renderProbe(
    elements.yomitanStatus,
    elements.yomitanDetail,
    status.yomitan_api ? { ...status.yomitan_api, label: localizeProbeLabel("yomitan", status.yomitan_api, t("notChecked")) } : status.yomitan_api,
    t("notChecked")
  );
  if (elements.bindStatus) {
    const pidText = status.pid ? ` (pid ${status.pid})` : "";
    elements.bindStatus.textContent = `${status.bind_host}:${status.bind_port}${pidText}`;
  }
  if (elements.configPath) {
    elements.configPath.textContent = status.config_path || "";
  }
  if (elements.launchTarget) {
    elements.launchTarget.textContent = status.launch_target || "";
  }
  if (elements.importErrorCard && elements.importErrorDetail) {
    const importError = String(status.last_import_error || "").trim();
    elements.importErrorCard.classList.toggle("hidden", !importError);
    elements.importErrorDetail.textContent = importError;
  }
  if (elements.audioStatusCard && elements.audioStatusLabel && elements.audioStatusDetail) {
    const audioStatus = String(status.last_import_audio_status || "").trim();
    const audioDetail = String(status.last_import_audio_detail || "").trim();
    const hasAudioInfo = !!audioStatus || !!audioDetail;
    elements.audioStatusCard.classList.toggle("hidden", !hasAudioInfo);
    elements.audioStatusLabel.textContent = audioStatus;
    elements.audioStatusDetail.textContent = audioDetail;
  }

  const logs = Array.isArray(snapshot.recent_logs) ? snapshot.recent_logs : [];
  if (elements.recentLogs) {
    elements.recentLogs.innerHTML = "";
    if (!logs.length) {
      const empty = document.createElement("li");
      empty.className = "log-empty";
      empty.textContent = t("noActivity");
      elements.recentLogs.appendChild(empty);
    } else {
      for (const line of logs) {
        const item = document.createElement("li");
        item.textContent = line;
        elements.recentLogs.appendChild(item);
      }
    }
  }

  if (elements.startBridge) elements.startBridge.disabled = status.running;
  if (elements.stopBridge) elements.stopBridge.disabled = !status.running;
}

function currentValueTemplate(fieldName) {
  const config = ensureConfig();
  return config.field_map[fieldName] || "";
}

async function persistFieldMapValue(fieldName, value) {
  const config = ensureConfig();
  const nextValue = String(value || "").trim();
  if (nextValue) {
    config.field_map[fieldName] = nextValue;
  } else {
    delete config.field_map[fieldName];
  }
  state.config = await call("save_app_config", { config });
  flashSavedState();
}

function renderMappingPanel() {
  if (!elements.mappingPanel || !elements.mappingGrid || !elements.mappingEmpty) return;
  elements.mappingPanel.classList.toggle("hidden", !state.mappingOpen);
  elements.toggleMapping?.setAttribute("aria-expanded", state.mappingOpen ? "true" : "false");
  if (elements.mappingChevron) {
    elements.mappingChevron.textContent = state.mappingOpen ? t("collapse") : t("expand");
  }
  if (!state.mappingOpen) {
    return;
  }

  const fields = Array.isArray(state.modelFields) ? state.modelFields : [];
  elements.mappingGrid.innerHTML = "";
  const hasFields = fields.length > 0;
  elements.mappingEmpty.classList.toggle("hidden", hasFields);
  if (!hasFields) return;

  for (const fieldName of fields) {
    const currentValue = currentValueTemplate(fieldName);
    const row = document.createElement("label");
    row.className = "mapping-row";

    const name = document.createElement("span");
    name.className = "mapping-name";
    name.textContent = fieldName;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "mapping-input";
    input.placeholder = t("mappingCustomPlaceholder");
    input.value = currentValue;
    const datalistId = `mapping-options-${fieldName.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}`;
    input.setAttribute("list", datalistId);

    const datalist = document.createElement("datalist");
    datalist.id = datalistId;
    for (const [, value] of state.valueOptions) {
      const option = document.createElement("option");
      option.value = value;
      datalist.appendChild(option);
    }
    const commitInputValue = async () => {
      try {
        await persistFieldMapValue(fieldName, input.value);
        const normalized = String(input.value || "").trim();
        input.value = normalized;
      } catch (error) {
        setSaveState(t("saveFailed", { error }), true);
      }
    };

    input.addEventListener("change", commitInputValue);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      }
    });

    row.append(name, input, datalist);
    elements.mappingGrid.appendChild(row);
  }
}

function preserveFieldMap(nextFields) {
  const config = ensureConfig();
  const allowed = new Set(nextFields);
  const nextMap = {};
  for (const [field, marker] of Object.entries(config.field_map)) {
    if (allowed.has(field) && marker) {
      nextMap[field] = marker;
    }
  }
  config.field_map = nextMap;
}

async function loadModelFields(modelName) {
  if (!modelName) {
    state.modelFields = [];
    renderMappingPanel();
    return;
  }
  try {
    const fields = await call("get_model_fields", { model: modelName });
    state.modelFields = Array.isArray(fields) ? fields : [];
    preserveFieldMap(state.modelFields);
    renderMappingPanel();
  } catch (error) {
    state.modelFields = [];
    renderMappingPanel();
    throw error;
  }
}

async function saveConfig(patch = {}) {
  const config = {
    ...ensureConfig(),
    ...patch,
  };
  try {
    state.config = await call("save_app_config", { config });
    flashSavedState();
  } catch (error) {
    setSaveState(t("saveFailed", { error }), true);
    throw error;
  }
}

async function syncAnkiLists() {
  try {
    const [decks, models] = await Promise.all([call("get_anki_decks"), call("get_anki_models")]);
    state.decks = Array.isArray(decks) ? decks : [];
    state.models = Array.isArray(models) ? models : [];
    const config = ensureConfig();
    if (!config.default_deck && state.decks.length) {
      config.default_deck = state.decks.includes("Default") ? "Default" : state.decks[0];
      await saveConfig({ default_deck: config.default_deck });
    }
    if (!config.default_model && state.models.length) {
      config.default_model = state.models.includes("Lapis") ? "Lapis" : state.models[0];
      await saveConfig({ default_model: config.default_model });
    }
    renderStaticConfig();
    if (config.default_model) {
      await loadModelFields(config.default_model);
    }
  } catch (error) {
    setSaveState(t("syncFailed", { error }), true);
  }
}

function shouldSyncAnki(snapshot) {
  return !!snapshot?.status?.bridge?.ok && !!snapshot?.status?.anki_connect?.ok;
}

function requestAnkiSync() {
  if (state.ankiSyncInFlight) {
    return state.ankiSyncInFlight;
  }
  const run = syncAnkiLists().finally(() => {
    state.ankiSyncInFlight = null;
  });
  state.ankiSyncInFlight = run;
  return run;
}

async function refreshSnapshot() {
  try {
    const snapshot = await call("get_app_snapshot");
    state.config = snapshot.config;
    state.valueOptions = Array.isArray(snapshot.value_options) ? snapshot.value_options : [];
    renderStaticConfig();
    renderStatus(snapshot);
    if (!state.modelFields.length && state.config?.default_model && snapshot.status.anki_connect?.ok) {
      await loadModelFields(state.config.default_model);
    }
    return snapshot;
  } catch (error) {
    setSaveState(t("snapshotFailed", { error }), true);
    return null;
  }
}

async function handleBridgeAction(command) {
  try {
    const snapshot = await call(command);
    state.config = snapshot.config;
    renderStaticConfig();
    renderStatus(snapshot);
    if (shouldSyncAnki(snapshot)) {
      void requestAnkiSync();
    }
  } catch (error) {
    setSaveState(t("actionFailed", { error }), true);
  }
}

async function ensureBridgeStarted(snapshot) {
  if (!snapshot || snapshot.status?.bridge?.ok || state.bridgeBootstrapTried) {
    return snapshot;
  }
  state.bridgeBootstrapTried = true;
  try {
    const startedSnapshot = await call("start_bridge_command");
    state.config = startedSnapshot.config;
    renderStaticConfig();
    renderStatus(startedSnapshot);
    return startedSnapshot;
  } catch (error) {
    setSaveState(t("bridgeAutostartFailed", { error }), true);
    return snapshot;
  }
}

function bindEvents() {
  elements.deckSelect?.addEventListener("change", async () => {
    await saveConfig({ default_deck: elements.deckSelect.value || "" });
  });

  elements.modelSelect?.addEventListener("change", async () => {
    const model = elements.modelSelect.value || "";
    try {
      await loadModelFields(model);
      await saveConfig({
        default_model: model,
        field_map: ensureConfig().field_map,
      });
    } catch (error) {
      setSaveState(t("fieldsFailed", { error }), true);
    }
  });

  elements.languageSelect?.addEventListener("change", async () => {
    const nextLanguage = elements.languageSelect.value || "en";
    await saveConfig({ language: nextLanguage });
    renderStaticConfig();
  });

  const commitDefaultTags = async () => {
    const normalized = String(elements.defaultTagsInput?.value || "").trim();
    if (elements.defaultTagsInput) {
      elements.defaultTagsInput.value = normalized;
    }
    await saveConfig({ default_tags: normalized || "VouoA" });
  };

  elements.defaultTagsInput?.addEventListener("change", commitDefaultTags);
  elements.defaultTagsInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      elements.defaultTagsInput.blur();
    }
  });

  elements.duplicateCheck?.addEventListener("change", async () => {
    await saveConfig({ duplicate_check: !!elements.duplicateCheck.checked });
  });

  elements.toggleMapping?.addEventListener("click", () => {
    state.mappingOpen = !state.mappingOpen;
    renderMappingPanel();
  });

  elements.applyLapis?.addEventListener("click", async () => {
    if (!window.confirm(t("confirmApplyLapis"))) {
      return;
    }
    const allowed = new Set(state.modelFields);
    const nextMap = {};
    for (const [field, marker] of Object.entries(LAPIS_FIELD_MAP)) {
      if (!allowed.size || allowed.has(field)) {
        nextMap[field] = marker;
      }
    }
    ensureConfig().field_map = nextMap;
    renderMappingPanel();
    await saveConfig({ field_map: nextMap });
  });

  elements.startBridge?.addEventListener("click", () => {
    handleBridgeAction("start_bridge_command");
  });

  elements.stopBridge?.addEventListener("click", () => {
    handleBridgeAction("stop_bridge_command");
  });

  elements.restartBridge?.addEventListener("click", () => {
    handleBridgeAction("restart_bridge_command");
  });

  window.addEventListener("focus", async () => {
    const snapshot = await refreshSnapshot();
    if (shouldSyncAnki(snapshot)) {
      void requestAnkiSync();
    }
  });

  document.addEventListener("visibilitychange", async () => {
    if (!document.hidden) {
      const snapshot = await refreshSnapshot();
      if (shouldSyncAnki(snapshot)) {
        void requestAnkiSync();
      }
    }
  });
}

async function init() {
  bindEvents();
  let snapshot = await refreshSnapshot();
  snapshot = await ensureBridgeStarted(snapshot);
  if (snapshot && !snapshot.status?.bridge?.ok) {
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    snapshot = await refreshSnapshot();
  }
  if (shouldSyncAnki(snapshot)) {
    await requestAnkiSync();
  }
}

init().catch((error) => {
  setSaveState(t("initFailed", { error }), true);
});
