(function () {
  if (document.getElementById("ankiouo-root")) {
    return;
  }

  const SUBTITLE_REFRESH_MS = 250;
  const SUBTITLE_MAX_MATCH_LENGTH = 16;
  const DEFAULT_AUDIO_FIELD = "SentenceAudio";
  const DEFAULT_PICTURE_FIELD = "Picture";
  const DEFAULT_DESKTOP_ANKI_URL = "http://127.0.0.1:5051/import";
  const DESKTOP_REQUEST_TIMEOUT_MS = 8000;
  const SUBTITLE_DRAG_THRESHOLD_PX = 8;
  const DESKTOP_ANKI_URL_STORAGE_KEY = "ankiouo.desktopAnkiUrl";
  const JIMAKU_CONFIG_STORAGE_KEY = "ankiouo.jimakuConfig";
  const LANGUAGE_STORAGE_KEY = "ankiouo.language";
  const LOOKUP_CSS_ENABLED_STORAGE_KEY = "ankiouo.lookupCssEnabled";
  const SUBTITLE_POSITION_STORAGE_KEY = "ankiouo.subtitlePosition";
  const SUBTITLE_BACKGROUND_ENABLED_STORAGE_KEY = "ankiouo.subtitleBackgroundEnabled";
  const SUBTITLE_BACKGROUND_STYLE_STORAGE_KEY = "ankiouo.subtitleBackgroundStyle";
  const SUBTITLE_CUSTOM_Y_STORAGE_KEY = "ankiouo.subtitleCustomY";
  const SWIPE_JUMP_ENABLED_STORAGE_KEY = "ankiouo.swipeJumpEnabled";
  const SWIPE_JUMP_MODE_STORAGE_KEY = "ankiouo.swipeJumpMode";
  const SWIPE_JUMP_STEP_STORAGE_KEY = "ankiouo.swipeJumpStep";
  const SWIPE_DEBUG_LOG_MAX = 80;
  const SWIPE_INDEX_CHAIN_WINDOW_MS = 1800;
  const LAUNCHER_SELECTION_BEHAVIOR_STORAGE_KEY = "ankiouo.launcherSelectionBehavior";
  const LAUNCHER_SELECTION_OPACITY_STORAGE_KEY = "ankiouo.launcherSelectionOpacity";
  const QUICK_QUEUE_BUTTON_ENABLED_STORAGE_KEY = "ankiouo.quickQueueButtonEnabled";
  const QUICK_YOMITAN_BUTTON_ENABLED_STORAGE_KEY = "ankiouo.quickYomitanButtonEnabled";
  const SUBTITLE_QUEUE_UI_ENABLED_STORAGE_KEY = "ankiouo.subtitleQueueUiEnabled";
  const LEGACY_SUBTITLE_BACKDROP_BLUR_STORAGE_KEY = "ankiouo.subtitleBackdropBlurEnabled";
  const LEGACY_SUBTITLE_BLUR_STORAGE_KEY = "ankiouo.subtitleBlurEnabled";
  const EXTENSION_API =
    typeof browser !== "undefined"
      ? browser
      : typeof chrome !== "undefined"
        ? chrome
        : null;

  const state = {
    subtitles: [],
    activeCue: null,
    videoRefreshHandle: null,
    currentResults: [],
    lastLookupEntry: null,
    ankiPayload: null,
    sourceAudioUrl: "",
    sourceAudioBackupUrl: "",
    sourceAudioCodecs: "",
    audioClipUrl: "",
    audioClipFilename: "",
    audioClipDataUrl: "",
    audioClipMime: "",
    screenshotUrl: "",
    screenshotFilename: "",
    screenshotDataUrl: "",
    trackedVideo: null,
    pauseOnSubtitleLookup: true,
    resumeOnPopupClose: false,
    closeLookupAfterAdd: true,
    lookupCssEnabled: true,
    language: "en",
    currentLookupToken: "",
    currentLookupSurface: "",
    currentLookupClozeContext: null,
    subtitleRenderToken: 0,
    rangePopupAnchorKey: "",
    subtitleOffsetMs: 0,
    subtitlePositionMode: "custom",
    subtitleBackgroundEnabled: false,
    subtitleBackgroundStyle: "plate",
    subtitleOverlayHidden: false,
    subtitleQueue: [],
    subtitleQueueIndex: -1,
    subtitleListVisible: false,
    subtitleListActiveIndex: -1,
    customSubtitleX: null,
    customSubtitleY: null,
    subtitleDragActive: false,
    subtitleDragPending: false,
    subtitleDragPointerId: 0,
    subtitleDragStartX: 0,
    subtitleDragStartY: 0,
    subtitleDragOffsetX: 0,
    subtitleDragOffsetY: 0,
    cueRangeSelection: null,
    rangePanelEntry: null,
    jimakuApiKey: "",
    jimakuMediaType: "anime",
    jimakuEntries: [],
    jimakuFiles: [],
    jimakuSelectedFileKeys: new Set(),
    jimakuSelectedEntry: null,
    jimakuSelectedQuery: "",
    jimakuView: "entries",
    jimakuSearchToken: 0,
    jimakuFilesToken: 0,
    jimakuSkipNextEpisodeChangeValue: "",
    jimakuImportInFlight: false,
    swipeJumpEnabled: false,
    swipeJumpMode: "cue",
    swipeJumpStepSeconds: 5,
    swipeDebugEvents: [],
    lastSwipeJumpIndex: -1,
    lastSwipeJumpAt: 0,
    swipeZonePointerMode: "",
    swipeZonePointerId: 0,
    swipeZoneStartX: 0,
    swipeZoneStartY: 0,
    subtitleOffsetDragPointerId: 0,
    subtitleOffsetDragStartY: 0,
    subtitleOffsetDragStartSeconds: 0,
    subtitleOffsetDragActive: false,
    launcherSelectionActive: false,
    launcherSelectionBehavior: "fade",
    launcherSelectionOpacity: 0.24,
    quickQueueButtonEnabled: false,
    quickYomitanButtonEnabled: true,
    subtitleQueueUiEnabled: false,
    lookupRequestId: 0,
    lookupRequestContext: "",
    surfaceLookupCache: new Map(),
    desktopLookupCache: new Map(),
    desktopAnkiFieldsCache: new Map(),
    segmenter:
      typeof Intl !== "undefined" && typeof Intl.Segmenter !== "undefined"
        ? new Intl.Segmenter("ja", { granularity: "word" })
        : null
  };

  const I18N = {
    en: {
      close: "Close",
      back: "Back",
      save: "Save",
      search: "Search",
      language: "Language",
      lookupTitle: "",
      lookupStatusHint: "",
      lookupEmpty: "",
      rangeTitle: "Sentence / Audio Range",
      noActiveSubtitle: "No active subtitle.",
      panelSubtitle: "",
      importSubtitle: "Import Subtitle",
      subtitleQueue: "Subtitle Queue",
      subtitleQueueEmpty: "No subtitles in queue yet.",
      subtitleQueuePrev: "Previous",
      subtitleQueueNext: "Next",
      subtitleQueueClear: "Clear Queue",
      subtitleQueueCurrent: "Current: {name}",
      topButtonsOnSubtitle: "Top buttons when subtitles are shown",
      topButtonsFade: "Fade",
      topButtonsHide: "Hide",
      topButtonsKeep: "Keep",
      topButtonsOpacity: "Fade opacity",
      quickQueueButton: "Show queue button on top right",
      quickYomitanButton: "Show Yomitan button",
      checkYomitanApi: "Check Yomitan API",
      quickSwipeJump: "Swipe",
      quickSubtitleList: "Subtitle List",
      quickQueue: "Queue",
      subtitleQueueUi: "Show queue controls",
      clearSubtitle: "Clear Subtitle",
      pauseOnLookup: "Pause video when clicking subtitles",
      closeLookupAfterAdd: "Close Lookup after Add Anki",
      lookupCss: "Lookup CSS",
      subtitleBackground: "Blur subtitle background",
      subtitleBackgroundStylePlate: "Backdrop",
      subtitleBackgroundStyleGlass: "Glass",
      quickHideSubtitle: "Hide",
      quickShowSubtitle: "Show",
      subtitleBottom: "Subtitle Bottom",
      subtitleTop: "Subtitle Top",
      subtitleCustom: "Custom Drag",
      resetPosition: "Reset Position",
      subtitleMinus: "Subtitle -0.5s",
      subtitlePlus: "Subtitle +0.5s",
      swipeJump: "Swipe jump",
      swipeJumpCue: "By subtitle",
      swipeJumpTime: "By time",
      swipeJumpStep: "Step (sec)",
      swipeZoneEdit: "Edit Swipe Area",
      swipeZoneDone: "Done Area",
      swipeZoneReset: "Reset Area",
      reset: "Reset",
      desktopAddress: "Desktop Address",
      jimakuApiKeyPlaceholder: "Jimaku API key",
      jimakuQueryPlaceholder: "Title / JP title / Romaji",
      jimakuEpisodePlaceholder: "Episode",
      jimakuStatusLocal: "Jimaku API key is stored locally in the extension.",
      lookupViaDesktop: "",
      startBridgeHint: "Start the desktop bridge and enable the API in Yomitan.",
      noSubtitleImported: "No subtitle imported.",
      subtitleFollowHint: "Import an .srt or .ass subtitle to start following the video.",
      subtitleOverlayEmpty: "Subtitles will appear directly over the video.",
      desktopAddressPrompt: "Enter desktop IP or address",
      notCheckedYet: "Not checked yet.",
      checking: "Checking...",
      entries: "Entries",
      filesForEntry: "Files · {label}",
      empty: "(empty)",
      unnamed: "(unnamed)",
      unsupported: "Unsupported",
      import: "Import",
      addSelected: "Add Selected",
      selectAll: "Select All",
      selectNone: "Clear",
      rangePopupEmpty: "No active subtitle.",
      statusYomitanConnected: "Yomitan API connected: {host}",
      statusYomitanFailed: "Yomitan API connection failed: {message}",
      statusDesktopUpdated: "Desktop address updated.",
      statusPauseOn: "Video will pause when clicking subtitles.",
      statusPauseOff: "Video will keep playing when clicking subtitles.",
      statusCloseLookupOn: "Lookup will close after Add Anki.",
      statusCloseLookupOff: "Lookup will stay open after Add Anki.",
      statusLookupCssOn: "Lookup CSS enabled.",
      statusLookupCssOff: "Lookup CSS disabled.",
      statusSubtitleBackgroundOn: "Subtitle background enabled.",
      statusSubtitleBackgroundOff: "Subtitle background disabled.",
      statusSubtitleBackgroundStylePlate: "Subtitle background style: Backdrop.",
      statusSubtitleBackgroundStyleGlass: "Subtitle background style: Glass.",
      statusSubtitleOverlayHidden: "Subtitle overlay hidden.",
      statusSubtitleOverlayShown: "Subtitle overlay restored.",
      statusLookupSearching: "Looking up \"{term}\"...",
      statusLookupFound: "Found {count} results.",
      statusLookupNone: "No results for \"{term}\".",
      statusNoLookupableWord: "No lookupable word found.",
      statusSelectWordFirst: "Enter a word to look up first.",
      statusNoTextSelection: "No text selected on this page.",
      statusLookupLoadingDesktop: "Looking up via desktop Yomitan API...",
      statusRangeEmpty: "No active subtitle.",
      emptyLabel: "(empty)",
      statusSubtitlePositionChanged: "Subtitle position changed to {position}.",
      statusSubtitlePositionReset: "Custom subtitle position reset.",
      statusSubtitleOffsetChanged: "Subtitle delay set to {offset}.",
      statusAnkiPayloadReady: "Anki export prepared for {expression}.",
      errorAnkiPayloadMissing: "No exportable card content yet.",
      errorNoExportableEntry: "No exportable entry found.",
      statusPreparingDesktopAudio: "Audio is clipped on desktop. Preparing screenshot...",
      statusDesktopSending: "3/3 Sending to desktop Anki...",
      statusDesktopLookupFailed: "Desktop lookup failed: {error}",
      statusDesktopLookupHint: "Make sure the desktop bridge is running and Yomitan API is enabled.",
      statusDesktopLookupFallback: "Desktop click-position lookup failed; fell back to normal lookup. ({error})",
      statusClickLookupFailed: "Click lookup failed: {error}",
      statusSubtitlesImportedNoVideo: "{count} subtitles imported (offset {offset}), but no video was found on this page.",
      statusSubtitlesFollowing: "{count} subtitles loaded (offset {offset}), following current video at {time}s.",
      statusSubtitleCurrent: "Loaded subtitle: {name} ({count} cues, offset {offset}){queue}",
      subtitleListTitle: "Subtitles",
      subtitleListEmpty: "No subtitles imported.",
      errorSubtitleParseEmpty: "No subtitle lines were parsed.",
      errorNoImportableSubtitle: "No importable subtitles found.",
      errorNoSubtitleFileSelected: "No subtitle file selected.",
      emptyJimakuEntries: "No Jimaku entries found.",
      emptyJimakuFiles: "No matching subtitle files for this entry.",
      subtitlePositionTop: "Top",
      subtitlePositionCustom: "Custom",
      subtitlePositionBottom: "Bottom",
      panelTitle: "VouoA Dictionary",
      jimakuTitle: "Jimaku Subtitles",
      jimakuButton: "Jimaku",
      statusInitFailed: "Initialization failed: {error}",
      statusAutoSendFailed: "Auto send failed: {error}",
      statusDesktopSendFailed: "Send to desktop Anki failed: {error}",
      statusDesktopQueued: "Request sent. Waiting for desktop processing...",
      statusDesktopSent: "3/3 Sent to desktop Anki.",
      statusPreparingScreenshot: "2/3 Preparing screenshot...",
      statusBuildingCard: "1/3 Building export for {expression}...",
      statusSubtitleImported: "Subtitle imported: {name}",
      statusSubtitleQueueAdded: "Added {count} subtitles to queue.",
      statusSubtitleSwitched: "Current subtitle: {name}",
      statusSubtitleImportFailed: "Subtitle import failed: {error}",
      statusSubtitleCleared: "Subtitle cleared.",
      statusSwipeJumpOn: "Swipe jump enabled.",
      statusSwipeJumpOff: "Swipe jump disabled.",
      statusSwipeZoneEditing: "Editing swipe area.",
      statusSwipeZoneSaved: "Swipe area saved.",
      statusSwipeZoneReset: "Swipe area reset.",
      statusJimakuNeedKey: "Save the Jimaku API key first.",
      statusJimakuNeedQuery: "Enter a title first.",
      statusJimakuSearching: "Searching Jimaku ({type}): {query}",
      statusJimakuEntries: "Found {count} Jimaku entries ({type}).",
      statusJimakuFiles: "Found {count} subtitle files.",
      statusJimakuDownload: "Downloading Jimaku subtitle: {name}",
      statusJimakuImported: "Imported Jimaku subtitle: {name}",
      statusJimakuReadFiles: "Loading subtitle files for {entry}...",
      statusJimakuBack: "Back to entries. Current type: {type}.",
      statusJimakuSaved: "Jimaku API key saved locally. Current type: {type}.",
      statusJimakuSearchFailed: "Jimaku search failed: {error}",
      statusJimakuFilesFailed: "Failed to load Jimaku files: {error}",
      statusJimakuImportFailed: "Failed to import Jimaku subtitle: {error}",
      statusJimakuTypeFailed: "Failed to switch Jimaku type: {error}",
      statusJimakuSaveFailed: "Failed to save Jimaku API key: {error}",
      statusJimakuNeedSelectFiles: "Select at least one subtitle file.",
    },
    "zh-CN": {
      close: "关闭",
      back: "返回",
      save: "保存",
      search: "搜索",
      language: "语言",
      lookupTitle: "",
      lookupStatusHint: "",
      lookupEmpty: "",
      rangeTitle: "句子/音频范围",
      noActiveSubtitle: "当前没有激活字幕。",
      panelSubtitle: "",
      importSubtitle: "导入字幕",
      subtitleQueue: "字幕队列",
      subtitleQueueEmpty: "队列里还没有字幕。",
      subtitleQueuePrev: "上一个",
      subtitleQueueNext: "下一个",
      subtitleQueueClear: "清空队列",
      subtitleQueueCurrent: "当前: {name}",
      topButtonsOnSubtitle: "字幕出现时顶部按钮",
      topButtonsFade: "淡化",
      topButtonsHide: "隐藏",
      topButtonsKeep: "不变",
      topButtonsOpacity: "淡化透明度",
      quickQueueButton: "右上角显示队列按钮",
      quickYomitanButton: "显示 Yomitan 按钮",
      checkYomitanApi: "检查 Yomitan API",
      quickSwipeJump: "划动",
      quickSubtitleList: "字幕列表",
      quickQueue: "队列",
      subtitleQueueUi: "显示队列控件",
      clearSubtitle: "清空字幕",
      pauseOnLookup: "点击字幕时暂停视频",
      closeLookupAfterAdd: "Add Anki 后自动关闭 Lookup",
      lookupCss: "Lookup CSS",
      subtitleBackground: "字幕背景模糊",
      subtitleBackgroundStylePlate: "Backdrop",
      subtitleBackgroundStyleGlass: "Glass",
      quickHideSubtitle: "隐藏",
      quickShowSubtitle: "显示",
      subtitleBottom: "字幕在下方",
      subtitleTop: "字幕在上方",
      subtitleCustom: "自定义拖动",
      resetPosition: "重置位置",
      subtitleMinus: "字幕 -0.5s",
      subtitlePlus: "字幕 +0.5s",
      swipeJump: "划动跳转",
      swipeJumpCue: "按句",
      swipeJumpTime: "按时间",
      swipeJumpStep: "步长(秒)",
      swipeZoneEdit: "编辑区域",
      swipeZoneDone: "完成区域",
      swipeZoneReset: "重置区域",
      reset: "重置",
      desktopAddress: "电脑地址",
      jimakuApiKeyPlaceholder: "Jimaku API key",
      jimakuQueryPlaceholder: "作品名 / 日文名 / 罗马字",
      jimakuEpisodePlaceholder: "集数",
      jimakuStatusLocal: "Jimaku API key 保存在插件本地。",
      lookupViaDesktop: "",
      startBridgeHint: "请启动电脑端 bridge，并在 Yomitan 中开启 API。",
      noSubtitleImported: "当前没有导入字幕。",
      subtitleFollowHint: "先导入一个 srt 或 ass 字幕，再开始跟随视频。",
      subtitleOverlayEmpty: "字幕会直接显示在视频上方。",
      desktopAddressPrompt: "输入电脑 IP 或地址",
      notCheckedYet: "尚未检查。",
      checking: "正在检查...",
      entries: "剧番列表",
      filesForEntry: "文件列表 · {label}",
      empty: "(空)",
      unnamed: "(未命名)",
      unsupported: "暂不支持",
      import: "导入",
      addSelected: "加入队列",
      selectAll: "全选",
      selectNone: "清空选择",
      rangePopupEmpty: "当前没有激活字幕。",
      statusYomitanConnected: "Yomitan API 已连接: {host}",
      statusYomitanFailed: "Yomitan API 连接失败: {message}",
      statusDesktopUpdated: "电脑地址已更新。",
      statusPauseOn: "点击字幕时会暂停视频。",
      statusPauseOff: "点击字幕时不再暂停视频。",
      statusCloseLookupOn: "Add Anki 后会自动关闭 Lookup。",
      statusCloseLookupOff: "Add Anki 后会保留 Lookup。",
      statusLookupCssOn: "已开启 Lookup CSS。",
      statusLookupCssOff: "已关闭 Lookup CSS。",
      statusSubtitleBackgroundOn: "已开启字幕背景模糊。",
      statusSubtitleBackgroundOff: "已关闭字幕背景模糊。",
      statusSubtitleBackgroundStylePlate: "字幕背景样式已切换为 Backdrop。",
      statusSubtitleBackgroundStyleGlass: "字幕背景样式已切换为 Glass。",
      statusSubtitleOverlayHidden: "字幕浮层已隐藏。",
      statusSubtitleOverlayShown: "字幕浮层已恢复。",
      statusLookupSearching: "正在查找 “{term}”...",
      statusLookupFound: "找到 {count} 条结果。",
      statusLookupNone: "没有找到 “{term}”。",
      statusNoLookupableWord: "没有找到可查询的词。",
      statusSelectWordFirst: "先输入要查的单词。",
      statusNoTextSelection: "当前网页没有选中文字。",
      statusLookupLoadingDesktop: "正在通过电脑端 Yomitan API 查词...",
      statusRangeEmpty: "当前没有激活字幕。",
      emptyLabel: "(空)",
      statusSubtitlePositionChanged: "字幕位置已切换到{position}。",
      statusSubtitlePositionReset: "已重置自定义字幕位置。",
      statusSubtitleOffsetChanged: "字幕延迟已设置为 {offset}。",
      statusAnkiPayloadReady: "已生成 {expression} 的 Anki 导出内容。",
      errorAnkiPayloadMissing: "还没有可导出的卡片内容。",
      errorNoExportableEntry: "没有可导出的词条。",
      statusPreparingDesktopAudio: "音频由电脑端裁剪，正在自动准备截图...",
      statusDesktopSending: "3/3 正在发送到电脑 Anki...",
      statusDesktopLookupFailed: "电脑端查词失败: {error}",
      statusDesktopLookupHint: "请确认电脑端 bridge 已启动，并且 Yomitan API 已开启。",
      statusDesktopLookupFallback: "电脑端点击定位失败，已改用普通查词。({error})",
      statusClickLookupFailed: "点击查词失败: {error}",
      statusSubtitlesImportedNoVideo: "已导入 {count} 条字幕（偏移 {offset}），但当前页面没有 video。",
      statusSubtitlesFollowing: "字幕已载入，共 {count} 条（偏移 {offset}），跟随当前视频时间 {time}s。",
      statusSubtitleCurrent: "字幕已载入: {name} ({count} 条，偏移 {offset}){queue}",
      subtitleListTitle: "字幕列表",
      subtitleListEmpty: "当前没有导入字幕。",
      errorSubtitleParseEmpty: "没有解析到字幕行。",
      errorNoImportableSubtitle: "没有可导入的字幕。",
      errorNoSubtitleFileSelected: "没有选择字幕文件。",
      emptyJimakuEntries: "没有找到 Jimaku 条目。",
      emptyJimakuFiles: "这个条目没有匹配的字幕文件。",
      subtitlePositionTop: "上方",
      subtitlePositionCustom: "自定义",
      subtitlePositionBottom: "下方",
      panelTitle: "VouoA Dictionary",
      jimakuTitle: "Jimaku 字幕",
      jimakuButton: "Jimaku",
      statusInitFailed: "初始化失败: {error}",
      statusAutoSendFailed: "自动发送失败: {error}",
      statusDesktopSendFailed: "发送到电脑 Anki 失败: {error}",
      statusDesktopQueued: "请求已发出，正在等待电脑端处理...",
      statusDesktopSent: "3/3 已发送到电脑 Anki。",
      statusPreparingScreenshot: "2/3 正在准备截图...",
      statusBuildingCard: "1/3 正在生成 {expression} 的导出内容...",
      statusSubtitleImported: "字幕导入完成: {name}",
      statusSubtitleQueueAdded: "已加入 {count} 个字幕到队列。",
      statusSubtitleSwitched: "当前字幕: {name}",
      statusSubtitleImportFailed: "导入字幕失败: {error}",
      statusSubtitleCleared: "已清空字幕。",
      statusSwipeJumpOn: "已开启划动跳转。",
      statusSwipeJumpOff: "已关闭划动跳转。",
      statusSwipeZoneEditing: "正在编辑划动区域。",
      statusSwipeZoneSaved: "划动区域已保存。",
      statusSwipeZoneReset: "划动区域已重置。",
      statusJimakuNeedKey: "先保存 Jimaku API key。",
      statusJimakuNeedQuery: "先输入作品名。",
      statusJimakuSearching: "正在搜索 Jimaku ({type}): {query}",
      statusJimakuEntries: "找到 {count} 个 Jimaku 条目 ({type})。",
      statusJimakuFiles: "找到 {count} 个字幕文件。",
      statusJimakuDownload: "正在下载 Jimaku 字幕: {name}",
      statusJimakuImported: "已导入 Jimaku 字幕: {name}",
      statusJimakuReadFiles: "正在读取 {entry} 的字幕文件...",
      statusJimakuBack: "已返回剧番列表，当前搜索类型: {type}。",
      statusJimakuSaved: "Jimaku API key 已保存到插件本地，当前搜索类型: {type}。",
      statusJimakuSearchFailed: "Jimaku 搜索失败: {error}",
      statusJimakuFilesFailed: "读取 Jimaku 文件失败: {error}",
      statusJimakuImportFailed: "导入 Jimaku 字幕失败: {error}",
      statusJimakuTypeFailed: "切换 Jimaku 类型失败: {error}",
      statusJimakuSaveFailed: "保存 Jimaku API key 失败: {error}",
      statusJimakuNeedSelectFiles: "请至少选择一个字幕文件。",
    }
  };

  function currentLanguage() {
    return I18N[state.language] ? state.language : "en";
  }

  function t(key, params = {}) {
    const table = I18N[currentLanguage()] || I18N.en;
    const template = table[key] ?? I18N.en[key] ?? key;
    return String(template).replace(/\{(\w+)\}/g, (_, token) => String(params[token] ?? ""));
  }

  const root = document.createElement("div");
  root.id = "ankiouo-root";
  root.innerHTML = `
    <div class="ankiouo-launcher-row">
      <div class="ankiouo-launcher-row-main">
        <button type="button" class="ankiouo-launcher ankiouo-launcher-brand" title="VouoA" aria-label="VouoA">VouoA</button>
        <button type="button" class="ankiouo-launcher ankiouo-launcher-quick ankiouo-icon-button" data-action="quick-toggle-subtitle" title="Hide" aria-label="Hide">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="14" x="3" y="5" rx="2" ry="2"/><path d="M7 15h4M15 15h2M7 11h2M13 11h4"/></svg>
        </button>
        <button type="button" class="ankiouo-launcher ankiouo-launcher-quick ankiouo-icon-button" data-action="quick-toggle-swipe-jump" title="Swipe" aria-label="Swipe">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>
          <span class="ankiouo-icon-state" data-field="quickSwipeJumpState">OFF</span>
        </button>
        <button type="button" class="ankiouo-launcher ankiouo-launcher-quick ankiouo-icon-button" data-action="quick-yomitan-check" title="Yomitan" aria-label="Yomitan">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22v-5"/><path d="M15 8V2"/><path d="M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z"/><path d="M9 8V2"/></svg>
        </button>
      </div>
      <div class="ankiouo-launcher-row-side">
        <button type="button" class="ankiouo-launcher ankiouo-launcher-quick ankiouo-icon-button" data-action="quick-toggle-subtitle-list" title="Subtitle List" aria-label="Subtitle List">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/></svg>
        </button>
        <button type="button" class="ankiouo-launcher ankiouo-launcher-quick ankiouo-icon-button ankiouo-hidden" data-action="quick-queue-toggle" title="Queue" aria-label="Queue">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 12 4 4 4-4"/><path d="M18 16V7"/><path d="m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16"/><path d="M3.304 13h6.392"/></svg>
        </button>
      </div>
    </div>
    <div class="ankiouo-quick-queue-popup ankiouo-hidden" data-field="quickQueuePopup">
      <div class="ankiouo-subtitle-queue-list" data-field="quickQueueList"></div>
    </div>
    <aside class="ankiouo-subtitle-list-panel ankiouo-hidden" data-field="subtitleListPanel">
      <div class="ankiouo-subtitle-list-head">
        <h2 class="ankiouo-section-title" data-i18n="subtitleListTitle">Subtitles</h2>
        <button type="button" class="ankiouo-secondary ankiouo-mini ankiouo-icon-button" data-action="close-subtitle-list" title="Close" aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <div class="ankiouo-subtitle-list" data-field="subtitleList"></div>
    </aside>
    <div class="ankiouo-video-overlay ankiouo-hidden" data-field="videoOverlay">
      <div data-field="videoSubtitleStage">
        <div class="ankiouo-empty" data-i18n="subtitleOverlayEmpty">Subtitles will appear directly over the video.</div>
      </div>
    </div>
    <div class="ankiouo-swipe-zone ankiouo-hidden" data-field="swipeZone">
      <div class="ankiouo-swipe-zone-handle ankiouo-swipe-zone-handle-top" data-swipe-handle="top"></div>
      <div class="ankiouo-swipe-zone-label" data-field="swipeZoneLabel">Swipe Jump Area</div>
      <div class="ankiouo-swipe-zone-handle ankiouo-swipe-zone-handle-bottom" data-swipe-handle="bottom"></div>
    </div>
    <section class="ankiouo-lookup-popup ankiouo-hidden" data-field="lookupPopup">
      <div class="ankiouo-section-head">
        <p class="ankiouo-meta" data-field="lookupStatus" data-i18n="lookupStatusHint"></p>
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="close-popup" data-i18n="close">Close</button>
      </div>
      <div class="ankiouo-results" data-field="popupResults">
        <div class="ankiouo-empty" data-i18n="lookupEmpty"></div>
      </div>
    </section>
    <section class="ankiouo-range-popup ankiouo-hidden" data-field="rangePopup">
      <div class="ankiouo-section-head">
        <h2 class="ankiouo-section-title" data-i18n="rangeTitle">Sentence / Audio Range</h2>
        <div class="ankiouo-entry-actions">
          <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="range-add-anki" title="Add Anki" aria-label="Add Anki">+</button>
          <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="close-range-popup" data-i18n="close">Close</button>
        </div>
      </div>
      <p class="ankiouo-meta" data-field="rangeStatus" data-i18n="noActiveSubtitle">No active subtitle.</p>
      <div class="ankiouo-dual-slider-wrap">
        <div class="ankiouo-dual-slider-track"></div>
        <div class="ankiouo-dual-slider-fill" data-field="rangeSliderFill"></div>
        <div class="ankiouo-dual-slider-handle ankiouo-dual-slider-handle-start" data-field="rangeStartHandle"></div>
        <div class="ankiouo-dual-slider-handle ankiouo-dual-slider-handle-end" data-field="rangeEndHandle"></div>
        <input type="range" min="0" max="0" value="0" step="1" class="ankiouo-dual-slider ankiouo-dual-slider-start" data-field="rangeStartInput" />
        <input type="range" min="0" max="0" value="0" step="1" class="ankiouo-dual-slider ankiouo-dual-slider-end" data-field="rangeEndInput" />
      </div>
      <div class="ankiouo-cue-chips" data-field="rangeCueChips"></div>
    </section>
    <section class="ankiouo-jimaku-modal ankiouo-hidden" data-field="jimakuModal">
      <div class="ankiouo-jimaku-modal-head">
        <div class="ankiouo-jimaku-head-main">
          <h2 class="ankiouo-section-title" data-i18n="jimakuTitle">Jimaku Subtitles</h2>
          <p class="ankiouo-jimaku-breadcrumb" data-field="jimakuBreadcrumb">Entries</p>
        </div>
        <div class="ankiouo-jimaku-head-actions">
          <button type="button" class="ankiouo-secondary ankiouo-mini ankiouo-hidden" data-action="jimaku-back" data-i18n="back">Back</button>
          <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="close-jimaku-modal" data-i18n="close">Close</button>
        </div>
      </div>
      <div class="ankiouo-impl-switch" data-field="jimakuTypeSwitch">
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="jimaku-type-anime">Anime</button>
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="jimaku-type-live-action">Live Action</button>
      </div>
      <div class="ankiouo-import-row ankiouo-import-row-wide">
        <input data-field="jimakuApiKey" type="password" autocomplete="off" placeholder="Jimaku API key" data-i18n-placeholder="jimakuApiKeyPlaceholder" />
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="save-jimaku-key" data-i18n="save">Save</button>
      </div>
      <div class="ankiouo-import-row ankiouo-import-row-wide">
        <input data-field="jimakuQuery" type="text" placeholder="Title / JP title / Romaji" data-i18n-placeholder="jimakuQueryPlaceholder" />
        <input data-field="jimakuEpisode" type="number" min="0" step="1" placeholder="Episode" data-i18n-placeholder="jimakuEpisodePlaceholder" />
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="jimaku-search" data-i18n="search">Search</button>
      </div>
      <div class="ankiouo-jimaku-results" data-field="jimakuResults"></div>
      <div class="ankiouo-jimaku-files-view ankiouo-hidden" data-field="jimakuFilesView">
        <div class="ankiouo-jimaku-selected" data-field="jimakuSelectedLabel"></div>
        <div class="ankiouo-import-row ankiouo-import-row-wide ankiouo-jimaku-files-actions">
          <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="jimaku-files-select-all" data-i18n="selectAll">Select All</button>
          <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="jimaku-files-clear-selection" data-i18n="selectNone">Clear</button>
          <button type="button" class="ankiouo-primary ankiouo-mini" data-action="jimaku-files-add-selected" data-i18n="addSelected">Add Selected</button>
        </div>
        <div class="ankiouo-jimaku-results" data-field="jimakuFiles"></div>
      </div>
      <p class="ankiouo-meta" data-field="jimakuStatus">Jimaku API key is stored locally in the extension.</p>
    </section>
    <section class="ankiouo-panel ankiouo-hidden">
      <div class="ankiouo-section-head">
        <h1 class="ankiouo-title" data-i18n="panelTitle">VouoA Dictionary</h1>
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="close-panel" data-i18n="close">Close</button>
      </div>
      <div class="ankiouo-import-row">
        <button type="button" class="ankiouo-primary" data-action="import-subtitle" data-i18n="importSubtitle">Import Subtitle</button>
        <button type="button" class="ankiouo-secondary" data-action="clear-subtitle" data-i18n="clearSubtitle">Clear Subtitle</button>
        <button type="button" class="ankiouo-secondary" data-action="open-jimaku-modal" data-i18n="jimakuButton">Jimaku</button>
      </div>
      <input data-field="subtitleFile" type="file" accept=".srt,.ass,.ssa" multiple class="ankiouo-hidden" />

      <section class="ankiouo-subtitle-queue-box">
        <div class="ankiouo-section-head">
          <h2 class="ankiouo-section-title" data-i18n="subtitleQueue">Subtitle Queue</h2>
          <div class="ankiouo-entry-actions">
            <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="subtitle-queue-prev" data-i18n="subtitleQueuePrev">Previous</button>
            <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="subtitle-queue-next" data-i18n="subtitleQueueNext">Next</button>
            <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="subtitle-queue-clear" data-i18n="subtitleQueueClear">Clear Queue</button>
          </div>
        </div>
        <p class="ankiouo-meta" data-field="subtitleQueueMeta" data-i18n="subtitleQueueEmpty">No subtitles in queue yet.</p>
        <div class="ankiouo-subtitle-queue-list" data-field="subtitleQueueList"></div>
      </section>
      <label class="ankiouo-toggle-row">
        <input data-field="subtitleQueueUiToggle" type="checkbox" />
        <span data-i18n="subtitleQueueUi">Show queue controls</span>
      </label>
      <label class="ankiouo-toggle-row" data-field="quickQueueButtonRow">
        <input data-field="quickQueueButtonToggle" type="checkbox" />
        <span data-i18n="quickQueueButton">Show queue button on top right</span>
      </label>

      <p class="ankiouo-meta" data-field="meta"></p>
      <p class="ankiouo-meta" data-field="subtitleMeta">No subtitle imported.</p>
      <label class="ankiouo-toggle-row">
        <input data-field="pauseOnLookupToggle" type="checkbox" checked />
        <span data-i18n="pauseOnLookup">Pause video when clicking subtitles</span>
      </label>
      <label class="ankiouo-toggle-row">
        <input data-field="closeLookupAfterAddToggle" type="checkbox" checked />
        <span data-i18n="closeLookupAfterAdd">Close Lookup after Add Anki</span>
      </label>
      <label class="ankiouo-toggle-row">
        <input data-field="lookupCssToggle" type="checkbox" checked />
        <span data-i18n="lookupCss">Lookup CSS</span>
      </label>
      <label class="ankiouo-toggle-row">
        <input data-field="subtitleBackgroundToggle" type="checkbox" />
        <span data-i18n="subtitleBackground">Blur subtitle background</span>
      </label>
      <div class="ankiouo-impl-switch" data-field="subtitleBackgroundStyleSwitch">
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="subtitle-bg-style-plate" data-i18n="subtitleBackgroundStylePlate">Backdrop</button>
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="subtitle-bg-style-glass" data-i18n="subtitleBackgroundStyleGlass">Glass</button>
      </div>
      <div class="ankiouo-import-row">
        <label class="ankiouo-field-label ankiouo-inline-label" data-i18n="topButtonsOnSubtitle">Top buttons on subtitle</label>
        <select data-field="launcherSelectionBehavior" class="ankiouo-desktop-url-input">
          <option value="fade">Fade</option>
          <option value="hide">Hide</option>
          <option value="keep">Keep</option>
        </select>
      </div>
      <div class="ankiouo-import-row" data-field="launcherSelectionOpacityRow">
        <label class="ankiouo-field-label ankiouo-inline-label" data-i18n="topButtonsOpacity">Fade opacity</label>
        <input data-field="launcherSelectionOpacity" type="range" min="0.05" max="0.95" step="0.05" value="0.24" />
      </div>
      <label class="ankiouo-toggle-row">
        <input data-field="quickYomitanButtonToggle" type="checkbox" />
        <span data-i18n="quickYomitanButton">Show Yomitan button</span>
      </label>
      <div class="ankiouo-import-row">
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="subtitle-pos-bottom" data-i18n="subtitleBottom">Subtitle Bottom</button>
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="subtitle-pos-top" data-i18n="subtitleTop">Subtitle Top</button>
      </div>
      <div class="ankiouo-import-row">
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="subtitle-pos-custom" data-i18n="subtitleCustom">Custom Drag</button>
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="subtitle-pos-reset" data-i18n="resetPosition">Reset Position</button>
      </div>
      <div class="ankiouo-import-row">
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="subtitle-offset-minus" data-i18n="subtitleMinus">Subtitle -0.5s</button>
        <input data-field="subtitleOffsetSec" type="number" step="0.1" value="0" style="width:86px;" />
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="subtitle-offset-plus" data-i18n="subtitlePlus">Subtitle +0.5s</button>
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="subtitle-offset-reset" data-i18n="reset">Reset</button>
      </div>
      <label class="ankiouo-toggle-row">
        <input data-field="swipeJumpToggle" type="checkbox" />
        <span data-i18n="swipeJump">Swipe jump</span>
      </label>
      <div class="ankiouo-impl-switch" data-field="swipeJumpModeSwitch">
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="swipe-mode-cue" data-i18n="swipeJumpCue">By subtitle</button>
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="swipe-mode-time" data-i18n="swipeJumpTime">By time</button>
      </div>
      <div class="ankiouo-import-row" data-field="swipeJumpStepRow">
        <label class="ankiouo-field-label ankiouo-inline-label" data-i18n="swipeJumpStep">Step (sec)</label>
        <input data-field="swipeJumpStepSec" type="number" min="0.1" step="0.1" value="5" style="width:86px;" />
      </div>
      <div class="ankiouo-import-row">
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="swipe-zone-edit" data-i18n="swipeZoneEdit">Edit Swipe Area</button>
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="swipe-zone-reset" data-i18n="swipeZoneReset">Reset Area</button>
      </div>
      <div class="ankiouo-import-row">
        <label class="ankiouo-field-label ankiouo-inline-label" data-i18n="language">Language</label>
        <select data-field="languageSelect" class="ankiouo-desktop-url-input">
          <option value="en">English</option>
          <option value="zh-CN">中文</option>
        </select>
      </div>
      <div class="ankiouo-import-row">
        <label class="ankiouo-field-label ankiouo-inline-label" data-i18n="desktopAddress">Desktop Address</label>
        <input
          class="ankiouo-desktop-url-input"
          data-field="desktopAnkiUrl"
          type="text"
          value="127.0.0.1"
        />
        <button type="button" class="ankiouo-secondary ankiouo-mini" data-action="check-yomitan-api" data-i18n="checkYomitanApi">Check Yomitan API</button>
      </div>
      <input data-field="query" type="hidden" value="" />
      <button type="button" data-action="search" class="ankiouo-hidden"></button>
      <button type="button" data-action="use-selection" class="ankiouo-hidden"></button>
      <div class="ankiouo-hidden" data-field="subtitleStage"></div>
      <div class="ankiouo-hidden" data-field="results"></div>
      <button type="button" data-action="send-desktop-anki" class="ankiouo-hidden"></button>
      <textarea data-field="ankiTemplate" class="ankiouo-hidden">{expression}|{furigana-plain}|{reading}|{glossary-first}|{cloze-prefix}|{cloze-body}|{cloze-suffix}|{glossary}</textarea>
      <textarea data-field="ankiPreview" class="ankiouo-hidden"></textarea>

      <p class="ankiouo-status" data-field="status"></p>
    </section>
  `;

  document.documentElement.appendChild(root);

  const launcherRow = root.querySelector(".ankiouo-launcher-row");
  const launcher = root.querySelector(".ankiouo-launcher");
  const quickSubtitleToggleButton = root.querySelector('[data-action="quick-toggle-subtitle"]');
  const quickSubtitleListButton = root.querySelector('[data-action="quick-toggle-subtitle-list"]');
  const quickSwipeJumpButton = root.querySelector('[data-action="quick-toggle-swipe-jump"]');
  const quickYomitanCheckButton = root.querySelector('[data-action="quick-yomitan-check"]');
  const quickQueueToggleButton = root.querySelector('[data-action="quick-queue-toggle"]');
  const quickQueuePopup = root.querySelector('[data-field="quickQueuePopup"]');
  const quickQueueList = root.querySelector('[data-field="quickQueueList"]');
  const subtitleListPanel = root.querySelector('[data-field="subtitleListPanel"]');
  const subtitleList = root.querySelector('[data-field="subtitleList"]');
  const closeSubtitleListButton = root.querySelector('[data-action="close-subtitle-list"]');
  const panel = root.querySelector(".ankiouo-panel");
  const swipeZone = root.querySelector('[data-field="swipeZone"]');
  const swipeZoneLabel = root.querySelector('[data-field="swipeZoneLabel"]');
  const lookupPopup = root.querySelector('[data-field="lookupPopup"]');
  const rangePopup = root.querySelector('[data-field="rangePopup"]');
  const jimakuModal = root.querySelector('[data-field="jimakuModal"]');
  const rangeStatus = root.querySelector('[data-field="rangeStatus"]');
  const rangeSliderWrap = root.querySelector('.ankiouo-dual-slider-wrap');
  const rangeSliderFill = root.querySelector('[data-field="rangeSliderFill"]');
  const rangeStartHandle = root.querySelector('[data-field="rangeStartHandle"]');
  const rangeEndHandle = root.querySelector('[data-field="rangeEndHandle"]');
  const rangeStartInput = root.querySelector('[data-field="rangeStartInput"]');
  const rangeEndInput = root.querySelector('[data-field="rangeEndInput"]');
  const rangeCueChips = root.querySelector('[data-field="rangeCueChips"]');
  const lookupStatus = root.querySelector('[data-field="lookupStatus"]');
  const status = root.querySelector('[data-field="status"]');
  const meta = root.querySelector('[data-field="meta"]');
  const subtitleMeta = root.querySelector('[data-field="subtitleMeta"]');
  const results = root.querySelector('[data-field="results"]');
  const popupResults = root.querySelector('[data-field="popupResults"]');
  const videoOverlay = root.querySelector('[data-field="videoOverlay"]');
  const videoSubtitleStage = root.querySelector('[data-field="videoSubtitleStage"]');
  const rootHomeParent = root.parentElement || document.documentElement;
  const overlayHomeParent = videoOverlay.parentElement || root;
  let fullscreenOverlayHost = null;
  const queryInput = root.querySelector('[data-field="query"]');
  const subtitleFile = root.querySelector('[data-field="subtitleFile"]');
  const subtitleStage = root.querySelector('[data-field="subtitleStage"]');
  const subtitleQueueMeta = root.querySelector('[data-field="subtitleQueueMeta"]');
  const subtitleQueueList = root.querySelector('[data-field="subtitleQueueList"]');
  const subtitleQueueBox = root.querySelector('.ankiouo-subtitle-queue-box');
  const launcherSelectionBehaviorSelect = root.querySelector('[data-field="launcherSelectionBehavior"]');
  const launcherSelectionOpacityRow = root.querySelector('[data-field="launcherSelectionOpacityRow"]');
  const launcherSelectionOpacityInput = root.querySelector('[data-field="launcherSelectionOpacity"]');
  const quickYomitanButtonToggle = root.querySelector('[data-field="quickYomitanButtonToggle"]');
  const ankiTemplate = root.querySelector('[data-field="ankiTemplate"]');
  const ankiPreview = root.querySelector('[data-field="ankiPreview"]');
  const desktopAnkiUrlInput = root.querySelector('[data-field="desktopAnkiUrl"]');
  const checkYomitanApiButton = root.querySelector('[data-action="check-yomitan-api"]');
  const importSubtitleButton = root.querySelector('[data-action="import-subtitle"]');
  const clearSubtitleButton = root.querySelector('[data-action="clear-subtitle"]');
  const openJimakuModalButton = root.querySelector('[data-action="open-jimaku-modal"]');
  const jimakuTypeSwitch = root.querySelector('[data-field="jimakuTypeSwitch"]');
  const jimakuTypeAnimeButton = root.querySelector('[data-action="jimaku-type-anime"]');
  const jimakuTypeLiveActionButton = root.querySelector('[data-action="jimaku-type-live-action"]');
  const jimakuBreadcrumb = root.querySelector('[data-field="jimakuBreadcrumb"]');
  const jimakuBackButton = root.querySelector('[data-action="jimaku-back"]');
  const jimakuApiKeyInput = root.querySelector('[data-field="jimakuApiKey"]');
  const jimakuQueryInput = root.querySelector('[data-field="jimakuQuery"]');
  const jimakuEpisodeInput = root.querySelector('[data-field="jimakuEpisode"]');
  const jimakuResults = root.querySelector('[data-field="jimakuResults"]');
  const jimakuFilesView = root.querySelector('[data-field="jimakuFilesView"]');
  const jimakuSelectedLabel = root.querySelector('[data-field="jimakuSelectedLabel"]');
  const jimakuFiles = root.querySelector('[data-field="jimakuFiles"]');
  const jimakuFilesActions = root.querySelector('.ankiouo-jimaku-files-actions');
  const jimakuStatus = root.querySelector('[data-field="jimakuStatus"]');
  const jimakuFilesSelectAllButton = root.querySelector('[data-action="jimaku-files-select-all"]');
  const jimakuFilesClearSelectionButton = root.querySelector('[data-action="jimaku-files-clear-selection"]');
  const jimakuFilesAddSelectedButton = root.querySelector('[data-action="jimaku-files-add-selected"]');
  const saveJimakuKeyButton = root.querySelector('[data-action="save-jimaku-key"]');
  const jimakuSearchButton = root.querySelector('[data-action="jimaku-search"]');
  const languageSelect = root.querySelector('[data-field="languageSelect"]');
  const searchButton = root.querySelector('[data-action="search"]');
  const useSelectionButton = root.querySelector('[data-action="use-selection"]');
  const sendDesktopAnkiButton = root.querySelector('[data-action="send-desktop-anki"]');
  const closePopupButton = root.querySelector('[data-action="close-popup"]');
  const closeRangePopupButton = root.querySelector('[data-action="close-range-popup"]');
  const closeJimakuModalButton = root.querySelector('[data-action="close-jimaku-modal"]');
  const rangeAddAnkiButton = root.querySelector('[data-action="range-add-anki"]');
  const closePanelButton = root.querySelector('[data-action="close-panel"]');
  const pauseOnLookupToggle = root.querySelector('[data-field="pauseOnLookupToggle"]');
  const closeLookupAfterAddToggle = root.querySelector('[data-field="closeLookupAfterAddToggle"]');
  const lookupCssToggle = root.querySelector('[data-field="lookupCssToggle"]');
  const quickQueueButtonToggle = root.querySelector('[data-field="quickQueueButtonToggle"]');
  const quickQueueButtonRow = root.querySelector('[data-field="quickQueueButtonRow"]');
  const quickSwipeJumpState = root.querySelector('[data-field="quickSwipeJumpState"]');
  const subtitleQueueUiToggle = root.querySelector('[data-field="subtitleQueueUiToggle"]');
  const subtitleBackgroundToggle = root.querySelector('[data-field="subtitleBackgroundToggle"]');
  const subtitleBackgroundStyleSwitch = root.querySelector('[data-field="subtitleBackgroundStyleSwitch"]');
  const subtitleBackgroundStylePlateButton = root.querySelector('[data-action="subtitle-bg-style-plate"]');
  const subtitleBackgroundStyleGlassButton = root.querySelector('[data-action="subtitle-bg-style-glass"]');
  const subtitlePosBottomButton = root.querySelector('[data-action="subtitle-pos-bottom"]');
  const subtitlePosTopButton = root.querySelector('[data-action="subtitle-pos-top"]');
  const subtitlePosCustomButton = root.querySelector('[data-action="subtitle-pos-custom"]');
  const subtitlePosResetButton = root.querySelector('[data-action="subtitle-pos-reset"]');
  const subtitleOffsetInput = root.querySelector('[data-field="subtitleOffsetSec"]');
  const subtitleOffsetMinusButton = root.querySelector('[data-action="subtitle-offset-minus"]');
  const subtitleOffsetPlusButton = root.querySelector('[data-action="subtitle-offset-plus"]');
  const subtitleOffsetResetButton = root.querySelector('[data-action="subtitle-offset-reset"]');
  const subtitleQueuePrevButton = root.querySelector('[data-action="subtitle-queue-prev"]');
  const subtitleQueueNextButton = root.querySelector('[data-action="subtitle-queue-next"]');
  const subtitleQueueClearButton = root.querySelector('[data-action="subtitle-queue-clear"]');
  const swipeJumpToggle = root.querySelector('[data-field="swipeJumpToggle"]');
  const swipeJumpModeSwitch = root.querySelector('[data-field="swipeJumpModeSwitch"]');
  const swipeModeCueButton = root.querySelector('[data-action="swipe-mode-cue"]');
  const swipeModeTimeButton = root.querySelector('[data-action="swipe-mode-time"]');
  const swipeJumpStepRow = root.querySelector('[data-field="swipeJumpStepRow"]');
  const swipeJumpStepInput = root.querySelector('[data-field="swipeJumpStepSec"]');
  const swipeZoneEditButton = root.querySelector('[data-action="swipe-zone-edit"]');
  const swipeZoneResetButton = root.querySelector('[data-action="swipe-zone-reset"]');

  function setStatus(message) {
    status.textContent = message;
  }

  function setLookupStatus(message) {
    lookupStatus.textContent = message;
  }

  function reportLookupFailure(message, target = popupResults) {
    const text = String(message || t("statusClickLookupFailed", { error: "Unknown error" })).trim() || t("statusClickLookupFailed", { error: "Unknown error" });
    setStatus(text);
    setLookupStatus(text);
    showResultsEmpty(text, target || popupResults);
    lookupPopup.classList.remove("ankiouo-hidden");
  }

  function setMeta(message) {
    meta.textContent = message;
  }

  function setSubtitleMeta(message) {
    subtitleMeta.textContent = message;
  }

  function setJimakuStatus(message) {
    if (jimakuStatus) {
      jimakuStatus.textContent = message;
    }
  }

  function getJimakuFileKey(file) {
    return String((file && (file.url || file.name || file.id)) || "").trim();
  }

  function makeSubtitleQueueItem(name, cues, extra = {}) {
    return {
      id: `subtitle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: String(name || t("unnamed")).trim() || t("unnamed"),
      cues: Array.isArray(cues) ? cues.slice() : [],
      source: String(extra.source || "local"),
      entryLabel: String(extra.entryLabel || "").trim()
    };
  }

  function getJimakuEpisodeValue() {
    return String(jimakuEpisodeInput && jimakuEpisodeInput.value ? jimakuEpisodeInput.value : "").trim();
  }

  function isJimakuQueueMode() {
    return !!state.subtitleQueueUiEnabled && !getJimakuEpisodeValue();
  }

  function isQuickQueueOpen() {
    return !!quickQueuePopup && !quickQueuePopup.classList.contains("ankiouo-hidden");
  }

  function setQuickQueueOpen(open) {
    if (!quickQueuePopup) return;
    quickQueuePopup.classList.toggle("ankiouo-hidden", !open);
  }

  function setIconButtonLabel(button, label) {
    if (!button) return;
    button.title = label;
    button.setAttribute("aria-label", label);
  }

  function setQuickYomitanButtonIcon(mode) {
    if (!quickYomitanCheckButton) return;
    const svg = quickYomitanCheckButton.querySelector("svg");
    if (!svg) return;
    const normalized = mode === "success" || mode === "failure" ? mode : "default";
    if (normalized === "success") {
      svg.innerHTML = `<path d="M17 19a1 1 0 0 1-1-1v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1z"/><path d="M17 21v-2"/><path d="M19 14V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V10"/><path d="M21 21v-2"/><path d="M3 5V3"/><path d="M4 10a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2z"/><path d="M7 5V3"/>`;
      return;
    }
    if (normalized === "failure") {
      svg.innerHTML = `<path d="m19 5 3-3"/><path d="m2 22 3-3"/><path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z"/><path d="M7.5 13.5 10 11"/><path d="M10.5 16.5 13 14"/><path d="m12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z"/>`;
      return;
    }
    svg.innerHTML = `<path d="M12 22v-5"/><path d="M15 8V2"/><path d="M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z"/><path d="M9 8V2"/>`;
  }

  function setQuickYomitanButtonLabel(label) {
    if (!quickYomitanCheckButton) return;
    setIconButtonLabel(quickYomitanCheckButton, label || "Yomitan");
  }

  function closeSubtitleListPanel() {
    state.subtitleListVisible = false;
    state.subtitleListActiveIndex = -1;
    if (subtitleListPanel) {
      subtitleListPanel.classList.add("ankiouo-hidden");
    }
    syncLauncherUi();
  }

  function toggleSubtitleListPanel() {
    state.subtitleListVisible = !state.subtitleListVisible;
    if (state.subtitleListVisible) {
      state.subtitleListActiveIndex = -1;
    }
    renderSubtitleList();
    syncLauncherUi();
  }

  function formatCueTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds || 0)));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const ss = String(secs).padStart(2, "0");
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
    }
    return `${minutes}:${ss}`;
  }

  function renderSubtitleList() {
    if (!subtitleListPanel || !subtitleList) return;
    const cues = Array.isArray(state.subtitles) ? state.subtitles : [];
    const visible = !!state.subtitleListVisible && cues.length > 0;
    subtitleListPanel.classList.toggle("ankiouo-hidden", !visible);
    clearElement(subtitleList);
    if (!visible) {
      if (state.subtitleListVisible && !cues.length) {
        state.subtitleListActiveIndex = -1;
        const empty = document.createElement("div");
        empty.className = "ankiouo-empty";
        empty.textContent = t("subtitleListEmpty");
        subtitleList.appendChild(empty);
      }
      return;
    }

    const activeIndex = getCueIndex(state.activeCue);
    cues.forEach((cue, index) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "ankiouo-subtitle-list-row";
      row.dataset.cueIndex = String(index);
      if (index === activeIndex) {
        row.classList.add("is-active");
      }
      const time = document.createElement("span");
      time.className = "ankiouo-subtitle-list-time";
      time.textContent = formatCueTime(cue.start);
      const text = document.createElement("span");
      text.className = "ankiouo-subtitle-list-text";
      text.textContent = String(cue.text || "").trim() || t("emptyLabel");
      row.appendChild(time);
      row.appendChild(text);
      row.addEventListener("click", () => {
        jumpToCueIndex(index);
      });
      subtitleList.appendChild(row);
    });

    const shouldScroll = activeIndex >= 0 && activeIndex !== state.subtitleListActiveIndex;
    state.subtitleListActiveIndex = activeIndex;
    const activeRow = shouldScroll ? subtitleList.querySelector(`[data-cue-index="${activeIndex}"]`) : null;
    if (activeRow && typeof activeRow.scrollIntoView === "function") {
      activeRow.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }
  }

  function createSubtitleQueueLabelButton(item, index, options = {}) {
    const { closeQuickQueue = false } = options;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ankiouo-subtitle-queue-label";
    if (index === state.subtitleQueueIndex) {
      button.classList.add("is-active");
    }
    button.textContent = item.name || t("unnamed");
    button.title = item.name || t("unnamed");
    button.addEventListener("click", () => {
      activateSubtitleQueueIndex(index);
      if (closeQuickQueue) {
        setQuickQueueOpen(false);
        syncLauncherUi();
      }
    });
    return button;
  }

  function renderSubtitleQueue() {
    if (!subtitleQueueMeta || !subtitleQueueList) return;
    if (subtitleQueueBox) {
      subtitleQueueBox.classList.toggle("ankiouo-hidden", !state.subtitleQueueUiEnabled);
    }
    clearElement(subtitleQueueList);
    if (quickQueueList) {
      clearElement(quickQueueList);
    }
    const queue = Array.isArray(state.subtitleQueue) ? state.subtitleQueue : [];
    if (!queue.length) {
      subtitleQueueMeta.textContent = t("subtitleQueueEmpty");
      syncLauncherUi();
      return;
    }
    const activeItem = queue[state.subtitleQueueIndex] || queue[0];
    subtitleQueueMeta.textContent = t("subtitleQueueCurrent", { name: activeItem && activeItem.name ? activeItem.name : t("unnamed") });
    queue.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "ankiouo-subtitle-queue-item";
      if (index === state.subtitleQueueIndex) {
        row.classList.add("is-active");
      }
      const button = createSubtitleQueueLabelButton(item, index);
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "ankiouo-secondary ankiouo-mini";
      removeButton.textContent = "x";
      removeButton.addEventListener("click", () => {
        removeSubtitleQueueIndex(index);
      });
      row.appendChild(button);
      row.appendChild(removeButton);
      subtitleQueueList.appendChild(row);
      if (quickQueueList) {
        const quickButton = createSubtitleQueueLabelButton(item, index, { closeQuickQueue: true });
        quickQueueList.appendChild(quickButton);
      }
    });
    syncLauncherUi();
  }

  function applySwipeJumpUi() {
    const hasSubtitles = Array.isArray(state.subtitles) && state.subtitles.length > 0;
    if (swipeJumpToggle) {
      swipeJumpToggle.checked = !!state.swipeJumpEnabled;
    }
    if (quickSwipeJumpButton) {
      quickSwipeJumpButton.classList.toggle("is-active", !!state.swipeJumpEnabled);
      quickSwipeJumpButton.disabled = !hasSubtitles;
      quickSwipeJumpButton.classList.toggle("ankiouo-hidden", !hasSubtitles);
      setIconButtonLabel(quickSwipeJumpButton, t("quickSwipeJump"));
    }
    if (quickSwipeJumpState) {
      quickSwipeJumpState.textContent = state.swipeJumpEnabled ? "ON" : "OFF";
    }
    if (swipeJumpModeSwitch) {
      swipeJumpModeSwitch.classList.toggle("ankiouo-hidden", !state.swipeJumpEnabled);
    }
    if (swipeModeCueButton) {
      swipeModeCueButton.classList.toggle("is-active", state.swipeJumpMode === "cue");
    }
    if (swipeModeTimeButton) {
      swipeModeTimeButton.classList.toggle("is-active", state.swipeJumpMode === "time");
    }
    if (swipeJumpStepRow) {
      swipeJumpStepRow.classList.toggle("ankiouo-hidden", !state.swipeJumpEnabled || state.swipeJumpMode !== "time");
    }
    if (swipeJumpStepInput) {
      swipeJumpStepInput.value = String(state.swipeJumpStepSeconds || 5);
      swipeJumpStepInput.disabled = !state.swipeJumpEnabled || state.swipeJumpMode !== "time";
    }
    if (swipeZoneEditButton) {
      swipeZoneEditButton.classList.add("ankiouo-hidden");
    }
    if (swipeZoneResetButton) {
      swipeZoneResetButton.classList.add("ankiouo-hidden");
    }
    if (swipeZone) {
      swipeZone.classList.toggle("ankiouo-hidden", !state.swipeJumpEnabled || !hasSubtitles);
      swipeZone.classList.remove("is-editing");
      swipeZone.style.top = "0px";
      swipeZone.style.height = `${Math.max(48, Math.round(window.innerHeight * 0.5))}px`;
    }
    if (swipeZoneLabel) {
      swipeZoneLabel.textContent = t("swipeJump");
    }
  }

  function syncLauncherUi() {
    const hasSubtitles = Array.isArray(state.subtitles) && state.subtitles.length > 0;
    if (!hasSubtitles && state.subtitleListVisible) {
      state.subtitleListVisible = false;
      renderSubtitleList();
    }
    if (launcherSelectionBehaviorSelect) {
      launcherSelectionBehaviorSelect.value = state.launcherSelectionBehavior;
      const optionLabels = {
        fade: t("topButtonsFade"),
        hide: t("topButtonsHide"),
        keep: t("topButtonsKeep")
      };
      Array.from(launcherSelectionBehaviorSelect.options).forEach((option) => {
        option.textContent = optionLabels[option.value] || option.value;
      });
    }
    if (launcherSelectionOpacityInput) {
      launcherSelectionOpacityInput.value = String(state.launcherSelectionOpacity || 0.24);
    }
    if (launcherSelectionOpacityRow) {
      launcherSelectionOpacityRow.classList.toggle("ankiouo-hidden", state.launcherSelectionBehavior !== "fade");
    }
    if (quickQueueButtonToggle) {
      quickQueueButtonToggle.checked = !!state.quickQueueButtonEnabled;
    }
    if (quickQueueButtonRow) {
      quickQueueButtonRow.classList.toggle("ankiouo-hidden", !state.subtitleQueueUiEnabled);
    }
    if (quickYomitanButtonToggle) {
      quickYomitanButtonToggle.checked = !!state.quickYomitanButtonEnabled;
    }
    if (subtitleQueueUiToggle) {
      subtitleQueueUiToggle.checked = !!state.subtitleQueueUiEnabled;
    }
    if (quickSubtitleListButton) {
      quickSubtitleListButton.classList.toggle("ankiouo-hidden", !hasSubtitles);
      quickSubtitleListButton.classList.toggle("is-active", !!state.subtitleListVisible);
      setIconButtonLabel(quickSubtitleListButton, t("quickSubtitleList"));
    }
    if (quickYomitanCheckButton) {
      quickYomitanCheckButton.classList.toggle("ankiouo-hidden", !state.quickYomitanButtonEnabled);
      setIconButtonLabel(quickYomitanCheckButton, "Yomitan");
    }
    if (quickSubtitleToggleButton) {
      quickSubtitleToggleButton.classList.toggle("ankiouo-hidden", !hasSubtitles);
    }
    if (launcherRow) {
      launcherRow.classList.remove("ankiouo-launcher-row-fade", "ankiouo-launcher-row-hidden");
      launcherRow.style.setProperty("--ankiouo-launcher-fade-opacity", String(state.launcherSelectionOpacity || 0.24));
      if (state.launcherSelectionActive) {
        if (state.launcherSelectionBehavior === "hide") {
          launcherRow.classList.add("ankiouo-launcher-row-hidden");
        } else if (state.launcherSelectionBehavior === "fade") {
          launcherRow.classList.add("ankiouo-launcher-row-fade");
        }
      }
    }
    const hasQueue = state.subtitleQueueUiEnabled && Array.isArray(state.subtitleQueue) && state.subtitleQueue.length > 1;
    const blockedByLauncherHide = state.launcherSelectionActive && state.launcherSelectionBehavior === "hide";
    if (quickQueueToggleButton) {
      quickQueueToggleButton.classList.toggle("ankiouo-hidden", !state.quickQueueButtonEnabled || !hasQueue || blockedByLauncherHide);
      setIconButtonLabel(quickQueueToggleButton, t("quickQueue"));
    }
    if (quickQueuePopup) {
      const open = isQuickQueueOpen() && state.quickQueueButtonEnabled && hasQueue && !blockedByLauncherHide;
      setQuickQueueOpen(open);
    }
    setIconButtonLabel(launcher, "VouoA");
    setIconButtonLabel(closeSubtitleListButton, t("close"));
  }

  function getActiveFullscreenElement() {
    return document.fullscreenElement || null;
  }

  function resolveFullscreenOverlayParent(video) {
    const fullscreenElement = getActiveFullscreenElement();
    if (!fullscreenElement) {
      return null;
    }
    if (!video) {
      return fullscreenElement instanceof HTMLElement ? fullscreenElement : null;
    }
    if (fullscreenElement === video) {
      return fullscreenElement.parentElement || null;
    }
    if (fullscreenElement instanceof HTMLElement && fullscreenElement.contains(video)) {
      return fullscreenElement;
    }
    return fullscreenElement instanceof HTMLElement ? fullscreenElement : null;
  }

  function ensureFullscreenOverlayHost(parent) {
    if (!parent) {
      return null;
    }
    if (!fullscreenOverlayHost || !fullscreenOverlayHost.isConnected) {
      fullscreenOverlayHost = document.createElement("div");
      fullscreenOverlayHost.id = "ankiouo-fullscreen-host";
    }
    if (fullscreenOverlayHost.parentElement !== parent) {
      parent.appendChild(fullscreenOverlayHost);
    }
    return fullscreenOverlayHost;
  }

  function syncRootContainer(video = state.trackedVideo) {
    const fullscreenParent = resolveFullscreenOverlayParent(video);
    if (fullscreenParent) {
      if (root.parentElement !== fullscreenParent) {
        fullscreenParent.appendChild(root);
      }
      return;
    }
    if (root.parentElement !== rootHomeParent) {
      rootHomeParent.appendChild(root);
    }
  }

  function syncVideoOverlayContainer(video = state.trackedVideo) {
    const fullscreenParent = resolveFullscreenOverlayParent(video);
    if (fullscreenParent) {
      const host = ensureFullscreenOverlayHost(fullscreenParent);
      if (host && videoOverlay.parentElement !== host) {
        host.appendChild(videoOverlay);
      }
      return;
    }

    if (videoOverlay.parentElement !== overlayHomeParent) {
      overlayHomeParent.appendChild(videoOverlay);
    }
    if (fullscreenOverlayHost && fullscreenOverlayHost.isConnected && !getActiveFullscreenElement()) {
      fullscreenOverlayHost.remove();
    }
  }

  function applyLanguage() {
    root.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (key) node.textContent = t(key);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      const key = node.getAttribute("data-i18n-placeholder");
      if (key) node.setAttribute("placeholder", t(key));
    });
    if (languageSelect) {
      languageSelect.value = currentLanguage();
    }
    if (state.jimakuView === "files" && state.jimakuSelectedEntry) {
      jimakuBreadcrumb.textContent = t("filesForEntry", { label: getJimakuEntryLabel(state.jimakuSelectedEntry) });
    } else if (jimakuBreadcrumb) {
      jimakuBreadcrumb.textContent = t("entries");
    }
    setQuickSubtitleButtonLabel();
    applySwipeJumpUi();
    syncLauncherUi();
    renderSubtitleQueue();
    renderSubtitleList();
  }

  function getJimakuApiKey() {
    return String(state.jimakuApiKey || "").trim();
  }

  function getJimakuMediaType() {
    return state.jimakuMediaType === "live_action" ? "live_action" : "anime";
  }

  function getJimakuMediaTypeLabel() {
    return getJimakuMediaType() === "live_action" ? "Live Action" : "Anime";
  }

  function getJimakuEntryLabel(entry) {
    const source = entry && typeof entry === "object" ? entry : {};
    const names = [source.name, source.japanese_name, source.english_name].filter(Boolean);
    return names.join(" / ") || `Entry ${source.id || ""}`.trim();
  }

  function sortJimakuEntries(entries) {
    return Array.isArray(entries) ? entries.slice() : [];
  }

  function setJimakuSelectedFileKey(fileKey, selected) {
    const key = String(fileKey || "").trim();
    if (!key) return;
    if (selected) {
      state.jimakuSelectedFileKeys.add(key);
    } else {
      state.jimakuSelectedFileKeys.delete(key);
    }
  }

  function clearJimakuSelectedFiles() {
    state.jimakuSelectedFileKeys = new Set();
  }

  function normalizeJimakuFiles(files) {
    return (Array.isArray(files) ? files.slice() : []).sort((left, right) =>
      String(left && left.name ? left.name : "").localeCompare(String(right && right.name ? right.name : ""), undefined, {
        numeric: true,
        sensitivity: "base"
      })
    );
  }

  function pruneJimakuSelectedFiles(files) {
    const availableKeys = new Set(files.map((file) => getJimakuFileKey(file)).filter(Boolean));
    state.jimakuSelectedFileKeys.forEach((key) => {
      if (!availableKeys.has(key)) {
        state.jimakuSelectedFileKeys.delete(key);
      }
    });
  }

  function openJimakuModal() {
    if (!jimakuModal) return;
    debugJimaku("openModal", {
      hasSelectedEntry: !!state.jimakuSelectedEntry,
      filesCount: Array.isArray(state.jimakuFiles) ? state.jimakuFiles.length : 0
    });
    setJimakuView(state.jimakuSelectedEntry && state.jimakuFiles.length ? "files" : "entries");
    jimakuModal.classList.remove("ankiouo-hidden");
    if (jimakuApiKeyInput && !jimakuApiKeyInput.value && state.jimakuApiKey) {
      jimakuApiKeyInput.value = state.jimakuApiKey;
    }
    if (jimakuQueryInput) {
      jimakuQueryInput.focus();
    }
  }

  function closeJimakuModal() {
    if (!jimakuModal) return;
    debugJimaku("closeModal");
    jimakuModal.classList.add("ankiouo-hidden");
  }

  function finishJimakuSuccessAndClose() {
    debugJimaku("finishSuccessAndClose");
    closeJimakuModal();
    clearJimakuSelection();
  }

  function clearJimakuSelection(options = {}) {
    const { keepFiles = false } = options;
    state.jimakuFilesToken += 1;
    state.jimakuSelectedEntry = null;
    state.jimakuSelectedQuery = "";
    clearJimakuSelectedFiles();
    if (!keepFiles) {
      state.jimakuFiles = [];
      if (jimakuFiles) {
        clearElement(jimakuFiles);
      }
    }
    setJimakuView("entries");
  }

  function setJimakuView(nextView) {
    state.jimakuView = nextView === "files" ? "files" : "entries";
    const isFiles = state.jimakuView === "files";
    if (jimakuResults) {
      jimakuResults.classList.toggle("ankiouo-hidden", isFiles);
    }
    if (jimakuFilesView) {
      jimakuFilesView.classList.toggle("ankiouo-hidden", !isFiles);
    }
    if (jimakuBackButton) {
      jimakuBackButton.classList.toggle("ankiouo-hidden", !isFiles);
    }
    if (jimakuBreadcrumb) {
      if (isFiles && state.jimakuSelectedEntry) {
        jimakuBreadcrumb.textContent = t("filesForEntry", { label: getJimakuEntryLabel(state.jimakuSelectedEntry) });
      } else {
        jimakuBreadcrumb.textContent = t("entries");
      }
    }
    if (jimakuSelectedLabel) {
      jimakuSelectedLabel.textContent = isFiles && state.jimakuSelectedEntry ? getJimakuEntryLabel(state.jimakuSelectedEntry) : "";
    }
  }

  function updateJimakuTypeUi() {
    const mediaType = getJimakuMediaType();
    if (jimakuTypeSwitch) {
      jimakuTypeSwitch.dataset.mediaType = mediaType;
    }
    if (jimakuTypeAnimeButton) {
      jimakuTypeAnimeButton.classList.toggle("is-active", mediaType === "anime");
    }
    if (jimakuTypeLiveActionButton) {
      jimakuTypeLiveActionButton.classList.toggle("is-active", mediaType === "live_action");
    }
  }

  async function setJimakuMediaType(nextType) {
    state.jimakuMediaType = nextType === "live_action" ? "live_action" : "anime";
    updateJimakuTypeUi();
    await persistJimakuConfig();
    clearJimakuSelection();
    setJimakuStatus(t("statusJimakuBack", { type: getJimakuMediaTypeLabel() }));
  }

  function setQuickSubtitleButtonLabel() {
    if (!quickSubtitleToggleButton) return;
    const hidden = !!state.subtitleOverlayHidden;
    const label = hidden ? t("quickShowSubtitle") : t("quickHideSubtitle");
    setIconButtonLabel(quickSubtitleToggleButton, label);
  }

  function setLauncherSelectionActive(active) {
    state.launcherSelectionActive = !!active;
    syncLauncherUi();
  }

  function normalizeDesktopAnkiUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return DEFAULT_DESKTOP_ANKI_URL;
    if (/^https?:\/\//i.test(raw)) {
      try {
        const url = new URL(raw);
        const pathname = url.pathname && url.pathname !== "/" ? url.pathname : "/import";
        return `${url.protocol}//${url.host}${pathname}`;
      } catch (error) {
        return raw;
      }
    }
    if (raw.includes("/")) {
      return `http://${raw}`;
    }
    if (raw.includes(":")) {
      return `http://${raw}/import`;
    }
    return `http://${raw}:5051/import`;
  }

  function getDesktopAnkiHost(value) {
    const raw = String(value || "").trim();
    if (!raw) return "127.0.0.1";
    try {
      const normalized = normalizeDesktopAnkiUrl(raw);
      const url = new URL(normalized);
      const defaultPort =
        (url.protocol === "http:" && url.port === "80") ||
        (url.protocol === "https:" && url.port === "443") ||
        url.port === "5051";
      return defaultPort ? url.hostname : url.host;
    } catch (error) {
      return raw
        .replace(/^https?:\/\//i, "")
        .replace(/\/.*$/, "")
        .trim();
    }
  }

  async function readStoredDesktopAnkiUrl() {
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        const result = await EXTENSION_API.storage.local.get(DESKTOP_ANKI_URL_STORAGE_KEY);
        const value = result ? result[DESKTOP_ANKI_URL_STORAGE_KEY] : "";
        return String(value || "");
      }
    } catch (error) {}
    try {
      return String(localStorage.getItem(DESKTOP_ANKI_URL_STORAGE_KEY) || "");
    } catch (error) {
      return "";
    }
  }

  async function persistDesktopAnkiUrl(value) {
    const normalized = normalizeDesktopAnkiUrl(value);
    state.desktopLookupCache.clear();
    state.desktopAnkiFieldsCache.clear();
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        await EXTENSION_API.storage.local.set({ [DESKTOP_ANKI_URL_STORAGE_KEY]: normalized });
      }
    } catch (error) {}
    try {
      localStorage.setItem(DESKTOP_ANKI_URL_STORAGE_KEY, normalized);
    } catch (error) {}
    if (desktopAnkiUrlInput) {
      desktopAnkiUrlInput.value = getDesktopAnkiHost(normalized);
    }
    return normalized;
  }

  async function readStoredLanguage() {
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        const result = await EXTENSION_API.storage.local.get(LANGUAGE_STORAGE_KEY);
        return String(result ? result[LANGUAGE_STORAGE_KEY] || "en" : "en");
      }
      return String(localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en");
    } catch (error) {
      return "en";
    }
  }

  async function persistLanguage(nextLanguage) {
    const normalized = nextLanguage === "zh-CN" ? "zh-CN" : "en";
    state.language = normalized;
    applyLanguage();
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        await EXTENSION_API.storage.local.set({ [LANGUAGE_STORAGE_KEY]: normalized });
        return;
      }
      localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    } catch (error) {
      // Ignore storage failures and keep the in-memory choice.
    }
  }

  async function readStoredLookupCssEnabled() {
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        const result = await EXTENSION_API.storage.local.get(LOOKUP_CSS_ENABLED_STORAGE_KEY);
        if (result && Object.prototype.hasOwnProperty.call(result, LOOKUP_CSS_ENABLED_STORAGE_KEY)) {
          return Boolean(result[LOOKUP_CSS_ENABLED_STORAGE_KEY]);
        }
        return true;
      }
      const stored = localStorage.getItem(LOOKUP_CSS_ENABLED_STORAGE_KEY);
      return stored == null ? true : stored === "true";
    } catch (error) {
      return true;
    }
  }

  async function persistLookupCssEnabled(nextValue) {
    const normalized = Boolean(nextValue);
    state.lookupCssEnabled = normalized;
    if (lookupCssToggle) {
      lookupCssToggle.checked = normalized;
    }
    state.desktopLookupCache.clear();
    state.desktopAnkiFieldsCache.clear();
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        await EXTENSION_API.storage.local.set({ [LOOKUP_CSS_ENABLED_STORAGE_KEY]: normalized });
        return;
      }
      localStorage.setItem(LOOKUP_CSS_ENABLED_STORAGE_KEY, normalized ? "true" : "false");
    } catch (error) {
      // Ignore storage failures and keep the in-memory choice.
    }
  }

  async function readStoredSubtitlePositionMode() {
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        const result = await EXTENSION_API.storage.local.get([SUBTITLE_POSITION_STORAGE_KEY, SUBTITLE_CUSTOM_Y_STORAGE_KEY]);
        const value = String(result ? result[SUBTITLE_POSITION_STORAGE_KEY] || "" : "").trim();
        if (value === "custom" && !Number.isFinite(Number(result ? result[SUBTITLE_CUSTOM_Y_STORAGE_KEY] : NaN))) {
          return "custom";
        }
        return ["bottom", "top", "custom"].includes(value) ? value : "custom";
      }
      const value = String(localStorage.getItem(SUBTITLE_POSITION_STORAGE_KEY) || "").trim();
      const storedCustomY = localStorage.getItem(SUBTITLE_CUSTOM_Y_STORAGE_KEY);
      if (value === "custom" && (storedCustomY == null || !Number.isFinite(Number(storedCustomY)))) {
        return "custom";
      }
      return ["bottom", "top", "custom"].includes(value) ? value : "custom";
    } catch (error) {
      return "custom";
    }
  }

  async function persistSubtitlePositionMode(nextValue) {
    const normalized = ["bottom", "top", "custom"].includes(nextValue) ? nextValue : "bottom";
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        await EXTENSION_API.storage.local.set({ [SUBTITLE_POSITION_STORAGE_KEY]: normalized });
        return;
      }
      localStorage.setItem(SUBTITLE_POSITION_STORAGE_KEY, normalized);
    } catch (error) {
      // Ignore storage failures and keep the in-memory choice.
    }
  }

  async function readStoredCustomSubtitleY() {
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        const result = await EXTENSION_API.storage.local.get(SUBTITLE_CUSTOM_Y_STORAGE_KEY);
        const value = Number(result ? result[SUBTITLE_CUSTOM_Y_STORAGE_KEY] : NaN);
        return Number.isFinite(value) ? value : null;
      }
      const value = Number(localStorage.getItem(SUBTITLE_CUSTOM_Y_STORAGE_KEY));
      return Number.isFinite(value) ? value : null;
    } catch (error) {
      return null;
    }
  }

  async function persistCustomSubtitleY(nextValue) {
    const shouldClear = nextValue == null || nextValue === "";
    const normalized = Number(nextValue);
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        await EXTENSION_API.storage.local.set({ [SUBTITLE_CUSTOM_Y_STORAGE_KEY]: shouldClear ? null : normalized });
        return;
      }
      if (shouldClear) {
        localStorage.removeItem(SUBTITLE_CUSTOM_Y_STORAGE_KEY);
      } else if (Number.isFinite(normalized)) {
        localStorage.setItem(SUBTITLE_CUSTOM_Y_STORAGE_KEY, String(normalized));
      }
    } catch (error) {
      // Ignore storage failures and keep the in-memory choice.
    }
  }

  async function readStoredSubtitleBackgroundEnabled() {
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        const result = await EXTENSION_API.storage.local.get([
          SUBTITLE_BACKGROUND_ENABLED_STORAGE_KEY,
          LEGACY_SUBTITLE_BACKDROP_BLUR_STORAGE_KEY,
          LEGACY_SUBTITLE_BLUR_STORAGE_KEY
        ]);
        if (result && Object.prototype.hasOwnProperty.call(result, SUBTITLE_BACKGROUND_ENABLED_STORAGE_KEY)) {
          return Boolean(result[SUBTITLE_BACKGROUND_ENABLED_STORAGE_KEY]);
        }
        return Boolean(
          result?.[LEGACY_SUBTITLE_BACKDROP_BLUR_STORAGE_KEY] ?? result?.[LEGACY_SUBTITLE_BLUR_STORAGE_KEY] ?? false
        );
      }
      const stored = localStorage.getItem(SUBTITLE_BACKGROUND_ENABLED_STORAGE_KEY);
      if (stored != null) return stored === "true";
      const legacyBackdrop = localStorage.getItem(LEGACY_SUBTITLE_BACKDROP_BLUR_STORAGE_KEY);
      if (legacyBackdrop != null) return legacyBackdrop === "true";
      const legacyBlur = localStorage.getItem(LEGACY_SUBTITLE_BLUR_STORAGE_KEY);
      if (legacyBlur != null) return legacyBlur === "true";
      return false;
    } catch (error) {
      return false;
    }
  }

  async function readStoredSubtitleBackgroundStyle() {
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        const result = await EXTENSION_API.storage.local.get([
          SUBTITLE_BACKGROUND_STYLE_STORAGE_KEY,
          LEGACY_SUBTITLE_BLUR_STORAGE_KEY
        ]);
        const stored = String(result?.[SUBTITLE_BACKGROUND_STYLE_STORAGE_KEY] || "").trim();
        if (stored === "plate" || stored === "glass") {
          return stored;
        }
        return result?.[LEGACY_SUBTITLE_BLUR_STORAGE_KEY] ? "glass" : "plate";
      }
      const stored = String(localStorage.getItem(SUBTITLE_BACKGROUND_STYLE_STORAGE_KEY) || "").trim();
      if (stored === "plate" || stored === "glass") return stored;
      return localStorage.getItem(LEGACY_SUBTITLE_BLUR_STORAGE_KEY) === "true" ? "glass" : "plate";
    } catch (error) {
      return "plate";
    }
  }

  function rerenderActiveSubtitleOverlay() {
    if (state.activeCue) {
      void renderSubtitleCue(state.activeCue);
    }
  }

  function applySubtitleBlurUi() {
    if (subtitleBackgroundToggle) {
      subtitleBackgroundToggle.checked = !!state.subtitleBackgroundEnabled;
    }
    if (subtitleBackgroundStyleSwitch) {
      subtitleBackgroundStyleSwitch.classList.toggle("ankiouo-hidden", !state.subtitleBackgroundEnabled);
    }
    if (subtitleBackgroundStylePlateButton) {
      subtitleBackgroundStylePlateButton.classList.toggle("is-active", state.subtitleBackgroundStyle === "plate");
    }
    if (subtitleBackgroundStyleGlassButton) {
      subtitleBackgroundStyleGlassButton.classList.toggle("is-active", state.subtitleBackgroundStyle === "glass");
    }
    if (videoOverlay) {
      videoOverlay.classList.toggle("ankiouo-subtitle-background-enabled", !!state.subtitleBackgroundEnabled);
      videoOverlay.classList.toggle("ankiouo-subtitle-background-plate", state.subtitleBackgroundEnabled && state.subtitleBackgroundStyle === "plate");
      videoOverlay.classList.toggle("ankiouo-subtitle-background-glass", state.subtitleBackgroundEnabled && state.subtitleBackgroundStyle === "glass");
    }
    setQuickSubtitleButtonLabel();
  }

  async function persistSubtitleBackgroundEnabled(nextValue) {
    const normalized = Boolean(nextValue);
    state.subtitleBackgroundEnabled = normalized;
    applySubtitleBlurUi();
    rerenderActiveSubtitleOverlay();
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        await EXTENSION_API.storage.local.set({ [SUBTITLE_BACKGROUND_ENABLED_STORAGE_KEY]: normalized });
        return;
      }
      localStorage.setItem(SUBTITLE_BACKGROUND_ENABLED_STORAGE_KEY, normalized ? "true" : "false");
    } catch (error) {
      // Ignore storage failures and keep the in-memory choice.
    }
  }

  async function persistSubtitleBackgroundStyle(nextValue) {
    const normalized = String(nextValue || "").trim() === "glass" ? "glass" : "plate";
    state.subtitleBackgroundStyle = normalized;
    applySubtitleBlurUi();
    rerenderActiveSubtitleOverlay();
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        await EXTENSION_API.storage.local.set({ [SUBTITLE_BACKGROUND_STYLE_STORAGE_KEY]: normalized });
        return;
      }
      localStorage.setItem(SUBTITLE_BACKGROUND_STYLE_STORAGE_KEY, normalized);
    } catch (error) {
      // Ignore storage failures and keep the in-memory choice.
    }
  }

  async function readStoredSwipeJumpEnabled() {
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        const result = await EXTENSION_API.storage.local.get(SWIPE_JUMP_ENABLED_STORAGE_KEY);
        if (result && Object.prototype.hasOwnProperty.call(result, SWIPE_JUMP_ENABLED_STORAGE_KEY)) {
          return Boolean(result[SWIPE_JUMP_ENABLED_STORAGE_KEY]);
        }
        return false;
      }
      return localStorage.getItem(SWIPE_JUMP_ENABLED_STORAGE_KEY) === "true";
    } catch (error) {
      return false;
    }
  }

  async function persistSwipeJumpEnabled(nextValue) {
    const normalized = Boolean(nextValue);
    state.swipeJumpEnabled = normalized;
    applySwipeJumpUi();
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        await EXTENSION_API.storage.local.set({ [SWIPE_JUMP_ENABLED_STORAGE_KEY]: normalized });
        return;
      }
      localStorage.setItem(SWIPE_JUMP_ENABLED_STORAGE_KEY, normalized ? "true" : "false");
    } catch (error) {}
  }

  async function readStoredSwipeJumpMode() {
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        const result = await EXTENSION_API.storage.local.get(SWIPE_JUMP_MODE_STORAGE_KEY);
        const value = String(result ? result[SWIPE_JUMP_MODE_STORAGE_KEY] || "" : "").trim();
        return value === "time" ? "time" : "cue";
      }
      return String(localStorage.getItem(SWIPE_JUMP_MODE_STORAGE_KEY) || "").trim() === "time" ? "time" : "cue";
    } catch (error) {
      return "cue";
    }
  }

  async function persistSwipeJumpMode(nextValue) {
    const normalized = String(nextValue || "").trim() === "time" ? "time" : "cue";
    state.swipeJumpMode = normalized;
    applySwipeJumpUi();
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        await EXTENSION_API.storage.local.set({ [SWIPE_JUMP_MODE_STORAGE_KEY]: normalized });
        return;
      }
      localStorage.setItem(SWIPE_JUMP_MODE_STORAGE_KEY, normalized);
    } catch (error) {}
  }

  async function readStoredSwipeJumpStep() {
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        const result = await EXTENSION_API.storage.local.get(SWIPE_JUMP_STEP_STORAGE_KEY);
        const value = Number(result ? result[SWIPE_JUMP_STEP_STORAGE_KEY] : NaN);
        return Number.isFinite(value) && value > 0 ? value : 5;
      }
      const value = Number(localStorage.getItem(SWIPE_JUMP_STEP_STORAGE_KEY));
      return Number.isFinite(value) && value > 0 ? value : 5;
    } catch (error) {
      return 5;
    }
  }

  async function persistSwipeJumpStep(nextValue) {
    const normalized = Math.max(0.1, Number(nextValue) || 5);
    state.swipeJumpStepSeconds = normalized;
    applySwipeJumpUi();
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        await EXTENSION_API.storage.local.set({ [SWIPE_JUMP_STEP_STORAGE_KEY]: normalized });
        return;
      }
      localStorage.setItem(SWIPE_JUMP_STEP_STORAGE_KEY, String(normalized));
    } catch (error) {}
  }

  async function readStoredScalar(key, fallbackValue) {
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        const result = await EXTENSION_API.storage.local.get(key);
        return result && Object.prototype.hasOwnProperty.call(result, key) ? result[key] : fallbackValue;
      }
      const stored = localStorage.getItem(key);
      return stored == null ? fallbackValue : stored;
    } catch (error) {
      return fallbackValue;
    }
  }

  async function persistStoredScalar(key, value) {
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        await EXTENSION_API.storage.local.set({ [key]: value });
        return;
      }
      localStorage.setItem(key, typeof value === "string" ? value : String(value));
    } catch (error) {}
  }

  async function readStoredLauncherSelectionBehavior() {
    const value = String(await readStoredScalar(LAUNCHER_SELECTION_BEHAVIOR_STORAGE_KEY, "fade") || "").trim();
    return ["fade", "hide", "keep"].includes(value) ? value : "fade";
  }

  async function persistLauncherSelectionBehavior(nextValue) {
    const normalized = ["fade", "hide", "keep"].includes(nextValue) ? nextValue : "fade";
    state.launcherSelectionBehavior = normalized;
    syncLauncherUi();
    await persistStoredScalar(LAUNCHER_SELECTION_BEHAVIOR_STORAGE_KEY, normalized);
  }

  async function readStoredLauncherSelectionOpacity() {
    const value = Number(await readStoredScalar(LAUNCHER_SELECTION_OPACITY_STORAGE_KEY, 0.24));
    return Number.isFinite(value) ? Math.max(0.05, Math.min(0.95, value)) : 0.24;
  }

  async function persistLauncherSelectionOpacity(nextValue) {
    const normalized = Math.max(0.05, Math.min(0.95, Number(nextValue) || 0.24));
    state.launcherSelectionOpacity = normalized;
    syncLauncherUi();
    await persistStoredScalar(LAUNCHER_SELECTION_OPACITY_STORAGE_KEY, normalized);
  }

  async function readStoredQuickQueueButtonEnabled() {
    return Boolean(await readStoredScalar(QUICK_QUEUE_BUTTON_ENABLED_STORAGE_KEY, false));
  }

  async function persistQuickQueueButtonEnabled(nextValue) {
    const normalized = Boolean(nextValue);
    state.quickQueueButtonEnabled = normalized;
    if (!normalized) {
      setQuickQueueOpen(false);
    }
    syncLauncherUi();
    await persistStoredScalar(QUICK_QUEUE_BUTTON_ENABLED_STORAGE_KEY, normalized);
  }

  async function readStoredQuickYomitanButtonEnabled() {
    return Boolean(await readStoredScalar(QUICK_YOMITAN_BUTTON_ENABLED_STORAGE_KEY, true));
  }

  async function persistQuickYomitanButtonEnabled(nextValue) {
    const normalized = Boolean(nextValue);
    state.quickYomitanButtonEnabled = normalized;
    syncLauncherUi();
    await persistStoredScalar(QUICK_YOMITAN_BUTTON_ENABLED_STORAGE_KEY, normalized);
  }

  async function readStoredSubtitleQueueUiEnabled() {
    return Boolean(await readStoredScalar(SUBTITLE_QUEUE_UI_ENABLED_STORAGE_KEY, false));
  }

  async function persistSubtitleQueueUiEnabled(nextValue) {
    const normalized = Boolean(nextValue);
    state.subtitleQueueUiEnabled = normalized;
    if (!normalized) {
      setQuickQueueOpen(false);
    }
    syncLauncherUi();
    renderSubtitleQueue();
    if (state.jimakuView === "files") {
      renderJimakuFiles(state.jimakuFiles);
    }
    await persistStoredScalar(SUBTITLE_QUEUE_UI_ENABLED_STORAGE_KEY, normalized);
  }

  async function readStoredJimakuConfig() {
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        const result = await EXTENSION_API.storage.local.get(JIMAKU_CONFIG_STORAGE_KEY);
        const value = result ? result[JIMAKU_CONFIG_STORAGE_KEY] : null;
        if (value && typeof value === "object") return value;
      }
    } catch (error) {}
    try {
      const raw = localStorage.getItem(JIMAKU_CONFIG_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  async function persistJimakuConfig() {
    const config = {
      apiKey: String(state.jimakuApiKey || "").trim(),
      mediaType: getJimakuMediaType()
    };
    try {
      if (EXTENSION_API && EXTENSION_API.storage && EXTENSION_API.storage.local) {
        await EXTENSION_API.storage.local.set({ [JIMAKU_CONFIG_STORAGE_KEY]: config });
      }
    } catch (error) {}
    try {
      localStorage.setItem(JIMAKU_CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (error) {}
    return config;
  }

  function applyJimakuConfig(config = {}) {
    state.jimakuApiKey = String(config.apiKey || "").trim();
    state.jimakuMediaType = String(config.mediaType || "anime") === "live_action" ? "live_action" : "anime";
    state.jimakuView = "entries";
    if (jimakuApiKeyInput) {
      jimakuApiKeyInput.value = state.jimakuApiKey;
    }
    updateJimakuTypeUi();
    setJimakuView("entries");
  }

  function getDesktopAnkiUrlValue() {
    const inputValue = desktopAnkiUrlInput ? desktopAnkiUrlInput.value : "";
    const normalized = normalizeDesktopAnkiUrl(inputValue);
    void persistDesktopAnkiUrl(normalized);
    return normalized;
  }

  function buildDesktopBridgeUrl(path, baseUrl = getDesktopAnkiUrlValue()) {
    const normalizedPath = `/${String(path || "").replace(/^\/+/, "")}`;
    const url = new URL(baseUrl);
    url.pathname = normalizedPath;
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  function getRemoteLookupArray(result) {
    if (Array.isArray(result)) return result;
    if (!result || typeof result !== "object") return [];
    const candidates = [result.dictionaryEntries, result.fields, result.entries, result.results, result.data, result.items];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  }

  function extractTermEntryHeadword(row) {
    const headwords = Array.isArray(row && row.headwords) ? row.headwords : [];
    const primary =
      headwords.find((item) => item && typeof item === "object" && item.isPrimary) ||
      headwords[0] ||
      null;
    return primary && typeof primary === "object" ? primary : null;
  }

  function extractTermEntryTags(headword) {
    const tags = Array.isArray(headword && headword.tags) ? headword.tags : [];
    return tags
      .map((tag) => {
        if (!tag || typeof tag !== "object") return "";
        return String(tag.name || tag.content || tag.category || "").trim();
      })
      .filter(Boolean)
      .join(" ");
  }

  function normalizeTermEntryGlossary(entries) {
    if (!Array.isArray(entries)) {
      return entries == null ? "" : entries;
    }
    if (entries.length === 1) {
      return entries[0];
    }
    return { tag: "ol", content: entries.map((item) => ({ tag: "li", content: item })) };
  }

  function extractDefinitionTags(definition) {
    const tags = Array.isArray(definition && definition.tags) ? definition.tags : [];
    return tags
      .map((tag) => {
        if (!tag || typeof tag !== "object") return "";
        return String(tag.name || tag.content || tag.category || "").trim();
      })
      .filter(Boolean);
  }

  function renderDefinitionTagBadge(label, type = "generic") {
    const text = String(label || "").trim();
    if (!text) return "";
    const className =
      type === "dictionary"
        ? "ankiouo-definition-tag ankiouo-definition-tag-dictionary"
        : "ankiouo-definition-tag ankiouo-definition-tag-generic";
    return `<span class="${className}">${escapeHtml(text)}</span>`;
  }

  function renderTermDefinitionGlossary(definition, dictionaryTitle = "") {
    if (!definition || typeof definition !== "object") return "";
    const normalizedGlossary = normalizeTermEntryGlossary(definition.entries);
    const glossaryHtml =
      typeof normalizedGlossary === "string" && /<[a-z][\s\S]*>/i.test(normalizedGlossary)
        ? normalizedGlossary
        : structuredNodeToHtml(normalizedGlossary, "original");
    const definitionTags = extractDefinitionTags(definition);
    const badges = [
      ...definitionTags.map((tag) => renderDefinitionTagBadge(tag, "generic")),
      dictionaryTitle ? renderDefinitionTagBadge(dictionaryTitle, "dictionary") : ""
    ].filter(Boolean).join("");
    return [
      `<div style="text-align: left;" class="yomitan-glossary">`,
      `<ol class="ankiouo-definition-list">`,
      `<li class="ankiouo-definition-item" data-dictionary="${escapeHtmlAttr(dictionaryTitle)}">`,
      badges ? `<div class="ankiouo-definition-tag-row">${badges}</div>` : "",
      `<div class="ankiouo-definition-item-content">${glossaryHtml}</div>`,
      `</li>`,
      `</ol>`,
      `</div>`
    ].join("");
  }

  function buildTermEntrySourceEntries(row, expression, reading, termTags) {
    const definitions = Array.isArray(row && row.definitions) ? row.definitions : [];
    return definitions
      .map((definition, index) => {
        if (!definition || typeof definition !== "object") return null;
        const dictionaryTitle = String(definition.dictionaryAlias || definition.dictionary || "").trim();
        const glossary = renderTermDefinitionGlossary(definition, dictionaryTitle);
        return {
          id: `remote-${expression || "term"}-${dictionaryTitle || "dict"}-${index}`,
          expression,
          reading,
          glossary,
          dictionaryTitle,
          termTags,
          raw: definition,
          remoteFields: definition,
          termMetaRows: []
        };
      })
      .filter((item) => item && (item.glossary || item.dictionaryTitle));
  }

  function buildTermEntryMetaRows(row, expression, reading) {
    const rows = [];
    const pronunciations = Array.isArray(row && row.pronunciations) ? row.pronunciations : [];
    pronunciations.forEach((item) => {
      if (!item || typeof item !== "object" || !Array.isArray(item.pronunciations)) return;
      const dictionaryTitle = String(item.dictionaryAlias || item.dictionary || "アクセント辞典").trim();
      const pitches = item.pronunciations
        .map((pronunciation) => {
          if (!pronunciation || typeof pronunciation !== "object") return null;
          if (pronunciation.type && pronunciation.type !== "pitch-accent") return null;
          const rawPositions = Array.isArray(pronunciation.positions)
            ? pronunciation.positions
            : typeof pronunciation.positions === "number"
              ? [pronunciation.positions]
              : typeof pronunciation.position === "number"
                ? [pronunciation.position]
                : typeof pronunciation.downstepPosition === "number"
                  ? [pronunciation.downstepPosition]
                  : typeof pronunciation.nasalPosition === "number"
                    ? [pronunciation.nasalPosition]
                    : [];
          const positions = rawPositions.filter((value) => Number.isFinite(Number(value))).map((value) => Number(value));
          if (!positions.length) return null;
          return {
            positions,
            nasalPositions: Array.isArray(pronunciation.nasalPositions) ? pronunciation.nasalPositions : [],
            devoicePositions: Array.isArray(pronunciation.devoicePositions) ? pronunciation.devoicePositions : []
          };
        })
        .filter(Boolean);
      if (!pitches.length) return;
      rows.push({
        dictionaryTitle,
        mode: "pitch",
        data: {
          reading: reading || expression,
          term: expression,
          pitches
        }
      });
    });

    const frequencies = Array.isArray(row && row.frequencies) ? row.frequencies : [];
    frequencies.forEach((item) => {
      if (!item || typeof item !== "object") return;
      rows.push({
        dictionaryTitle: String(item.dictionaryAlias || item.dictionary || "Frequency").trim(),
        mode: "freq",
        data: {
          frequency: item.displayValue != null && item.displayValue !== "" ? item.displayValue : item.frequency
        }
      });
    });

    return rows;
  }

  function buildRemoteMetaRows(fields, dictionaryTitle = "") {
    const rows = [];
    const pushRow = (mode, data) => {
      if (data == null || data === "") return;
      rows.push({
        dictionaryTitle,
        mode,
        data: typeof data === "string" ? data : JSON.stringify(data)
      });
    };
    if (!fields || typeof fields !== "object") {
      return rows;
    }
    pushRow("pitch-position", fields["pitch-accent-positions"]);
    pushRow("pitch", fields["pitch-accents"]);
    pushRow("freq", fields.frequencies);
    pushRow("freq-rank", fields["frequency-harmonic-rank"]);
    return rows;
  }

  function normalizeRemoteLookupRow(row, index, fallbackTerm) {
    if (row && typeof row === "object" && Array.isArray(row.headwords) && Array.isArray(row.definitions)) {
      const headword = extractTermEntryHeadword(row);
      const expression = String((headword && headword.term) || row.expression || fallbackTerm || "").trim();
      const reading = String((headword && headword.reading) || row.reading || "").trim();
      const termTags = extractTermEntryTags(headword);
      const sourceEntries = buildTermEntrySourceEntries(row, expression, reading, termTags);
      return {
        id: `remote-${index}-${expression || fallbackTerm || "term"}`,
        expression,
        reading,
        glossary: sourceEntries[0] ? sourceEntries[0].glossary : "",
        dictionaryTitle: sourceEntries[0] ? sourceEntries[0].dictionaryTitle : "",
        termTags,
        raw: row,
        remoteFields: row,
        sourceEntries,
        termMetaRows: buildTermEntryMetaRows(row, expression, reading)
      };
    }

    const fields = row && typeof row === "object" && row.fields && typeof row.fields === "object" ? row.fields : row || {};
    const expression = String(fields.expression || row.expression || fallbackTerm || "").trim();
    const reading = String(fields.reading || row.reading || "").trim();
    const glossary =
      fields.glossary != null
        ? fields.glossary
        : fields.definition != null
          ? fields.definition
          : row.glossary != null
            ? row.glossary
            : "";
    const dictionaryTitle = String(
      row.dictionaryTitle ||
        row.dictionary ||
        row.title ||
        fields.dictionary ||
        fields.dictionaryTitle ||
        ""
    ).trim();
    const termTags = String(fields.tags || row.tags || row.termTags || "").trim();
    return {
      id: `remote-${index}-${expression || fallbackTerm || "term"}`,
      expression,
      reading,
      glossary,
      dictionaryTitle,
      termTags,
      raw: row,
      remoteFields: fields,
      sourceEntries: [],
      termMetaRows: buildRemoteMetaRows(fields, dictionaryTitle)
    };
  }

  function convertDesktopLookupResult(result, fallbackTerm) {
    const rows = getRemoteLookupArray(result)
      .map((row, index) => normalizeRemoteLookupRow(row, index, fallbackTerm))
      .filter((row) => row.expression || row.reading || row.glossary);

    if (!rows.length) {
      return [];
    }

    const grouped = groupEntriesBySurface(rows);
    return grouped.map((entry) => {
      const mergedSourceEntries = [];
      const mergedMetaRows = [];
      const seenMeta = new Set();
      (Array.isArray(entry.termMetaRows) ? entry.termMetaRows : []).forEach((row) => {
        const key = `${row.dictionaryTitle || ""}\n${row.mode || ""}\n${String(row.data || "")}`;
        if (seenMeta.has(key)) return;
        seenMeta.add(key);
        mergedMetaRows.push(row);
      });
      (Array.isArray(entry.sourceEntries) ? entry.sourceEntries : []).forEach((sourceEntry) => {
        const sourceKey = `${sourceEntry.dictionaryTitle || ""}\n${String(sourceEntry.glossary || "")}`;
        if (!mergedSourceEntries.some((item) => `${item.dictionaryTitle || ""}\n${String(item.glossary || "")}` === sourceKey)) {
          mergedSourceEntries.push(sourceEntry);
        }
        (Array.isArray(sourceEntry.termMetaRows) ? sourceEntry.termMetaRows : []).forEach((row) => {
          const key = `${row.dictionaryTitle || ""}\n${row.mode || ""}\n${String(row.data || "")}`;
          if (seenMeta.has(key)) return;
          seenMeta.add(key);
          mergedMetaRows.push(row);
        });
      });
      return {
        ...entry,
        sourceEntries: mergedSourceEntries,
        termMetaRows: mergedMetaRows
      };
    });
  }

  function mergeMetaRowsUnique(rows) {
    const seenMeta = new Set();
    const mergedMetaRows = [];
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const key = `${row.dictionaryTitle || ""}\n${row.mode || ""}\n${String(row.data || "")}`;
      if (seenMeta.has(key)) return;
      seenMeta.add(key);
      mergedMetaRows.push(row);
    });
    return mergedMetaRows;
  }

  function normalizeDesktopAnkiFieldsPayload(payload) {
    if (!payload || typeof payload !== "object") return [];
    const result = payload.result;
    if (result && typeof result === "object" && !Array.isArray(result)) {
      if (Array.isArray(result.fields)) {
        return result.fields.filter((item) => item && typeof item === "object");
      }
      return [result];
    }
    return [];
  }

  async function fetchDesktopAnkiFields(term) {
    const key = String(term || "").trim();
    if (!key) return [];
    if (state.desktopAnkiFieldsCache.has(key)) {
      return state.desktopAnkiFieldsCache.get(key);
    }
    const response = await fetchDesktopJson(buildDesktopBridgeUrl("/yomitan/ankiFields"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        term: key
      })
    });
    const payload = response.payload;
    if (!response.ok || !payload || payload.ok === false) {
      throw new Error((payload && payload.error) || `HTTP ${response.status}`);
    }
    const normalized = normalizeDesktopAnkiFieldsPayload(payload);
    state.desktopAnkiFieldsCache.set(key, normalized);
    return normalized;
  }

  function extractDictionaryBlocksFromGlossaryHtml(html) {
    const source = String(html || "").trim();
    if (!source || typeof document === "undefined" || !/<[a-z][\s\S]*>/i.test(source)) {
      return [];
    }
    const container = document.createElement("div");
    container.innerHTML = source;
    const styleContent = Array.from(container.querySelectorAll("style"))
      .map((node) => String(node.textContent || ""))
      .join("\n")
      .trim();
    const styleBlock = styleContent ? `<style>${styleContent}</style>` : "";
    const items = Array.from(container.querySelectorAll('.yomitan-glossary li[data-dictionary], li[data-dictionary]'));
    if (!items.length) {
      return [{
        dictionaryTitle: "",
        glossary: source
      }];
    }
    return items
      .map((item) => {
        const dictionaryTitle = String(item.getAttribute("data-dictionary") || "").trim();
        const listHtml = `<ol>${item.outerHTML}</ol>`;
        return {
          dictionaryTitle,
          glossary: `<div style="text-align: left;" class="yomitan-glossary">${styleBlock}${listHtml}</div>`
        };
      })
      .filter((item) => item.glossary);
  }

  function normalizeLookupMatchKey(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/\s+/g, "")
      .trim();
  }

  function takeMatchingAnkiFieldsForEntry(entry, pendingFields, fallbackIndex) {
    if (!Array.isArray(pendingFields) || !pendingFields.length) return null;

    const expressionKey = normalizeLookupMatchKey(entry && entry.expression);
    const readingKey = normalizeLookupMatchKey(entry && entry.reading);

    const findIndexBy = (predicate) => {
      for (let i = 0; i < pendingFields.length; i += 1) {
        const item = pendingFields[i];
        if (item && predicate(item)) return i;
      }
      return -1;
    };

    let matchedIndex = -1;
    if (expressionKey && readingKey) {
      matchedIndex = findIndexBy((item) => {
        const itemExpressionKey = normalizeLookupMatchKey(item.expression);
        const itemReadingKey = normalizeLookupMatchKey(item.reading);
        return itemExpressionKey === expressionKey && itemReadingKey === readingKey;
      });
    }
    if (matchedIndex < 0 && expressionKey) {
      matchedIndex = findIndexBy((item) => normalizeLookupMatchKey(item.expression) === expressionKey);
    }
    if (matchedIndex < 0 && readingKey) {
      matchedIndex = findIndexBy((item) => normalizeLookupMatchKey(item.reading) === readingKey);
    }
    if (matchedIndex < 0 && Number.isInteger(fallbackIndex) && fallbackIndex >= 0 && fallbackIndex < pendingFields.length) {
      matchedIndex = fallbackIndex;
    }
    if (matchedIndex < 0) {
      debugLookup("ankiFieldsMatchMiss", {
        entryExpression: entry && entry.expression ? entry.expression : "",
        entryReading: entry && entry.reading ? entry.reading : "",
        fallbackIndex,
        pendingCount: pendingFields.length
      });
      return null;
    }
    const matched = pendingFields.splice(matchedIndex, 1)[0] || null;
    debugLookup("ankiFieldsMatchHit", {
      entryExpression: entry && entry.expression ? entry.expression : "",
      entryReading: entry && entry.reading ? entry.reading : "",
      matchedIndex,
      matchedExpression: matched && matched.expression ? matched.expression : "",
      matchedReading: matched && matched.reading ? matched.reading : "",
      remainingCount: pendingFields.length
    });
    return matched;
  }

  function applyAnkiFieldsToLookupEntries(entries, fieldsList, fallbackTerm) {
    const sourceEntries = Array.isArray(entries) ? entries : [];
    const pendingFields = Array.isArray(fieldsList) ? fieldsList.slice() : [];
    debugLookup("applyAnkiFieldsStart", {
      entryCount: sourceEntries.length,
      fieldsCount: pendingFields.length,
      fallbackTerm
    });
    return sourceEntries.map((entry, entryIndex) => {
      const normalizedFields = takeMatchingAnkiFieldsForEntry(entry, pendingFields, entryIndex);
      if (!normalizedFields || typeof normalizedFields !== "object") {
        debugLookup("applyAnkiFieldsSkipEntry", {
          entryIndex,
          entryExpression: entry && entry.expression ? entry.expression : "",
          entryReading: entry && entry.reading ? entry.reading : ""
        });
        return entry;
      }
      const glossaryBlocks = extractDictionaryBlocksFromGlossaryHtml(normalizedFields.glossary);
      const fallbackExpression = String(
        normalizedFields.expression ||
        entry.expression ||
        fallbackTerm ||
        ""
      ).trim();
      const fallbackReading = String(
        normalizedFields.reading ||
        entry.reading ||
        ""
      ).trim();
      const mergedMetaRows = mergeMetaRowsUnique([
        ...(Array.isArray(entry.termMetaRows) ? entry.termMetaRows : []),
        ...buildRemoteMetaRows(normalizedFields, "")
      ]);
      if (!glossaryBlocks.length) {
        debugLookup("applyAnkiFieldsNoGlossaryBlocks", {
          entryIndex,
          entryExpression: fallbackExpression || (entry && entry.expression ? entry.expression : ""),
          entryReading: fallbackReading || (entry && entry.reading ? entry.reading : "")
        });
        return {
          ...entry,
          expression: fallbackExpression || entry.expression,
          reading: fallbackReading || entry.reading,
          remoteFields: { ...(entry.remoteFields || {}), ...normalizedFields },
          termMetaRows: mergedMetaRows
        };
      }
      const enhancedSourceEntries = glossaryBlocks.map((block, blockIndex) => ({
        id: `anki-fields-${entryIndex}-${blockIndex}-${fallbackExpression || "term"}`,
        expression: fallbackExpression || entry.expression,
        reading: fallbackReading || entry.reading,
        glossary: block.glossary,
        dictionaryTitle: block.dictionaryTitle,
        termTags: entry.termTags || "",
        raw: entry.raw,
        remoteFields: normalizedFields,
        sourceEntries: [],
        termMetaRows: []
      }));
      return {
        ...entry,
        expression: fallbackExpression || entry.expression,
        reading: fallbackReading || entry.reading,
        glossary: enhancedSourceEntries[0] ? enhancedSourceEntries[0].glossary : entry.glossary,
        dictionaryTitle: enhancedSourceEntries[0] ? enhancedSourceEntries[0].dictionaryTitle : entry.dictionaryTitle,
        remoteFields: { ...(entry.remoteFields || {}), ...normalizedFields },
        sourceEntries: enhancedSourceEntries,
        termMetaRows: mergedMetaRows
      };
    });
  }

  async function applyLookupCssPerEntry(entries, fallbackTerm) {
    const sourceEntries = Array.isArray(entries) ? entries : [];
    if (!sourceEntries.length) {
      return sourceEntries;
    }

    debugLookup("applyLookupCssPerEntryStart", {
      entryCount: sourceEntries.length,
      fallbackTerm
    });

    const enhanced = await Promise.all(
      sourceEntries.map(async (entry, entryIndex) => {
        const term = String((entry && entry.expression) || fallbackTerm || "").trim();
        if (!term) {
          debugLookup("applyLookupCssPerEntrySkipNoTerm", { entryIndex });
          return entry;
        }
        try {
          const fields = await fetchDesktopAnkiFields(term);
          const [nextEntry] = applyAnkiFieldsToLookupEntries([entry], fields, term);
          return nextEntry || entry;
        } catch (error) {
          debugLookup("applyLookupCssPerEntryError", {
            entryIndex,
            term,
            error: error && error.message ? error.message : String(error)
          });
          return entry;
        }
      })
    );

    return enhanced;
  }

  async function fetchDesktopLookup(query) {
    const key = String(query || "").trim();
    if (!key) {
      return { entries: [], resolvedTerm: "" };
    }
    if (state.desktopLookupCache.has(key)) {
      return state.desktopLookupCache.get(key);
    }
    const requestUrl = `${buildDesktopBridgeUrl("/lookup")}?term=${encodeURIComponent(key)}`;
    const response = await fetchDesktopJson(requestUrl, { method: "GET" });
    const payload = response.payload;
    if (!response.ok || !payload || payload.ok === false) {
      throw new Error((payload && payload.error) || `HTTP ${response.status}`);
    }
    let entries = convertDesktopLookupResult(payload.result, key);
    const resolvedTerm = entries[0] ? String(entries[0].expression || key).trim() : key;
    if (state.lookupCssEnabled) {
      entries = await applyLookupCssPerEntry(entries, key);
    }
    const normalized = { entries, resolvedTerm };
    state.desktopLookupCache.set(key, normalized);
    return normalized;
  }

  async function fetchDesktopLookupAt(text, index) {
    const requestUrl = buildDesktopBridgeUrl("/lookup-at");
    const response = await fetchDesktopJson(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: String(text || ""),
        index: Number(index)
      })
    });
    const payload = response.payload;
    if (!response.ok || !payload || payload.ok === false) {
      throw new Error((payload && payload.error) || `HTTP ${response.status}`);
    }
    let entries = convertDesktopLookupResult(payload.result, payload.lookupQuery || payload.lookupSurface || "");
    const lookupQuery = String(payload.lookupQuery || payload.lookupSurface || "").trim();
    const lookupCssTerm = String(payload.lookupSurface || payload.lookupQuery || "").trim();
    if (state.lookupCssEnabled) {
      entries = await applyLookupCssPerEntry(entries, lookupCssTerm);
    }
    return {
      lookupQuery: String(payload.lookupQuery || "").trim(),
      lookupSurface: String(payload.lookupSurface || "").trim(),
      lookupStart: Number(payload.lookupStart),
      lookupEnd: Number(payload.lookupEnd),
      entries
    };
  }

  function formatBytes(bytes) {
    const size = Number(bytes);
    if (!Number.isFinite(size) || size < 0) return "";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1).replace(/\.0$/, "")} KB`;
    return `${(size / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
  }

  function isSupportedJimakuSubtitle(name) {
    return /\.(srt|ass|ssa)$/i.test(String(name || ""));
  }

  async function saveJimakuApiKey() {
    const apiKey = String(jimakuApiKeyInput && jimakuApiKeyInput.value ? jimakuApiKeyInput.value : "").trim();
    if (!apiKey) {
      setJimakuStatus(t("statusJimakuNeedKey"));
      if (jimakuApiKeyInput) jimakuApiKeyInput.focus();
      return;
    }
    state.jimakuApiKey = apiKey;
    await persistJimakuConfig();
    setJimakuStatus(t("statusJimakuSaved", { type: getJimakuMediaTypeLabel() }));
  }

  async function fetchJimakuEntries(queryText) {
    const response = await sendRuntimeMessage({
      type: "fetchJimakuApi",
      path: "/api/entries/search",
      query: {
        query: queryText,
        anime: getJimakuMediaType() === "live_action" ? "false" : "true"
      },
      apiKey: getJimakuApiKey(),
      timeoutMs: 15000
    });
    return Array.isArray(response.data) ? response.data : [];
  }

  async function fetchJimakuFiles(entryId, episode) {
    const response = await sendRuntimeMessage({
      type: "fetchJimakuApi",
      path: `/api/entries/${encodeURIComponent(entryId)}/files`,
      query: {
        episode: String(episode || "").trim()
      },
      apiKey: getJimakuApiKey(),
      timeoutMs: 15000
    });
    return Array.isArray(response.data) ? response.data : [];
  }

  async function importJimakuSubtitle(file) {
    debugJimaku("fetchSubtitleRequest", {
      fileName: file && file.name ? file.name : "",
      fileUrl: file && file.url ? file.url : ""
    });
    const response = await sendRuntimeMessage({
      type: "fetchJimakuSubtitle",
      url: file && file.url ? file.url : "",
      name: file && file.name ? file.name : "",
      apiKey: getJimakuApiKey(),
      timeoutMs: 30000
    });
    debugJimaku("fetchSubtitleResponse", {
      fileName: file && file.name ? file.name : "",
      hasSubtitle: !!(response && response.data && response.data.subtitle),
      responseKeys: response && typeof response === "object" ? Object.keys(response) : []
    });
    return (response.data && response.data.subtitle) || {};
  }

  function formatApiResultValue(value) {
    if (value == null || value === "") return "ok";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  function debugJimaku(kind, details = {}) {
    try {
      console.debug("[VouoA jimaku]", {
        at: new Date().toISOString(),
        kind,
        inFlight: !!state.jimakuImportInFlight,
        view: state.jimakuView || "",
        selectedEntryId: state.jimakuSelectedEntry && state.jimakuSelectedEntry.id ? state.jimakuSelectedEntry.id : "",
        selectedFileCount:
          state.jimakuSelectedFileKeys instanceof Set ? state.jimakuSelectedFileKeys.size : Array.isArray(state.jimakuSelectedFileKeys) ? state.jimakuSelectedFileKeys.length : 0,
        ...details
      });
    } catch (error) {
      console.debug("[VouoA jimaku]", kind, details);
    }
  }

  function debugLookup(kind, details = {}) {
    try {
      const entry = {
        at: new Date().toISOString(),
        kind,
        lookupCssEnabled: !!state.lookupCssEnabled,
        currentLookupToken: state.currentLookupToken || "",
        currentLookupSurface: state.currentLookupSurface || "",
        ...details
      };
      window.__vouoaLookupDebug = window.__vouoaLookupDebug || [];
      window.__vouoaLookupDebug.push(entry);
      if (window.__vouoaLookupDebug.length > 120) {
        window.__vouoaLookupDebug.splice(0, window.__vouoaLookupDebug.length - 120);
      }
      console.debug("[VouoA lookup]", entry);
    } catch (error) {
      console.debug("[VouoA lookup]", kind, details);
    }
  }

  function debugRange(kind, details = {}) {
    try {
      const entry = {
        at: new Date().toISOString(),
        kind,
        popupHidden: !rangePopup || rangePopup.classList.contains("ankiouo-hidden"),
        hasRangeEntry: !!state.rangePanelEntry,
        activeCueIndex: getCueIndex(state.activeCue),
        ...details
      };
      window.__vouoaRangeDebug = window.__vouoaRangeDebug || [];
      window.__vouoaRangeDebug.push(entry);
      if (window.__vouoaRangeDebug.length > 120) {
        window.__vouoaRangeDebug.splice(0, window.__vouoaRangeDebug.length - 120);
      }
      console.debug("[VouoA range]", entry);
    } catch (error) {
      console.debug("[VouoA range]", kind, details);
    }
  }

  async function ensureDesktopBridgeHostForQuickCheck() {
    const currentValue = desktopAnkiUrlInput ? String(desktopAnkiUrlInput.value || "").trim() : "";
    const currentHost = getDesktopAnkiHost(currentValue || DEFAULT_DESKTOP_ANKI_URL);
    const needsPrompt = !currentHost || /^(127\.0\.0\.1|localhost)$/i.test(currentHost);
    if (!needsPrompt) {
      return currentHost;
    }
    const suggested = /^(127\.0\.0\.1|localhost)$/i.test(currentHost) ? "" : currentHost;
    const answer = window.prompt(t("desktopAddressPrompt"), suggested);
    if (answer == null) {
      return "";
    }
    const normalized = normalizeDesktopAnkiUrl(answer);
    await persistDesktopAnkiUrl(normalized);
    if (desktopAnkiUrlInput) {
      desktopAnkiUrlInput.value = getDesktopAnkiHost(normalized);
    }
    return getDesktopAnkiHost(normalized);
  }

  async function checkYomitanApiConnection() {
    const [serverResponse, yomitanResponse] = await Promise.all([
      fetchDesktopJson(buildDesktopBridgeUrl("/yomitan/serverVersion"), { method: "GET" }),
      fetchDesktopJson(buildDesktopBridgeUrl("/yomitan/yomitanVersion"), { method: "GET" })
    ]);
    const serverPayload = serverResponse.payload;
    const yomitanPayload = yomitanResponse.payload;
    if (!serverResponse.ok || !serverPayload || serverPayload.ok === false) {
      throw new Error((serverPayload && serverPayload.error) || `serverVersion HTTP ${serverResponse.status}`);
    }
    if (!yomitanResponse.ok || !yomitanPayload || yomitanPayload.ok === false) {
      throw new Error((yomitanPayload && yomitanPayload.error) || `yomitanVersion HTTP ${yomitanResponse.status}`);
    }
    return {
      serverVersion: formatApiResultValue(serverPayload.result),
      yomitanVersion: formatApiResultValue(yomitanPayload.result)
    };
  }

  async function quickCheckYomitanApiConnection() {
    const host = await ensureDesktopBridgeHostForQuickCheck();
    if (!host) {
      setQuickYomitanButtonIcon("failure");
      setQuickYomitanButtonLabel("Yomitan");
      return;
    }
    setQuickYomitanButtonIcon("default");
    setQuickYomitanButtonLabel("Yomitan");
    if (quickYomitanCheckButton) quickYomitanCheckButton.disabled = true;
    try {
      const { serverVersion, yomitanVersion } = await checkYomitanApiConnection();
      setQuickYomitanButtonIcon("success");
      setStatus(`Yomitan OK: ${host} | API ${serverVersion} / Yomitan ${yomitanVersion}`);
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      setQuickYomitanButtonIcon("failure");
      setStatus(t("statusYomitanFailed", { message }));
    } finally {
      if (quickYomitanCheckButton) {
        quickYomitanCheckButton.disabled = false;
      }
      setQuickYomitanButtonLabel("Yomitan");
    }
  }

  async function panelCheckYomitanApiConnection() {
    const rawValue = desktopAnkiUrlInput ? String(desktopAnkiUrlInput.value || "").trim() : "";
    const normalized = normalizeDesktopAnkiUrl(rawValue || DEFAULT_DESKTOP_ANKI_URL);
    await persistDesktopAnkiUrl(normalized);
    if (desktopAnkiUrlInput) {
      desktopAnkiUrlInput.value = getDesktopAnkiHost(normalized);
    }
    const host = getDesktopAnkiHost(normalized);
    if (!host) {
      throw new Error(t("desktopAddressPrompt"));
    }
    const { serverVersion, yomitanVersion } = await checkYomitanApiConnection();
    setStatus(`Yomitan OK: ${host} | API ${serverVersion} / Yomitan ${yomitanVersion}`);
  }

  function getSubtitlePositionLabel() {
    if (state.subtitlePositionMode === "top") return t("subtitlePositionTop");
    if (state.subtitlePositionMode === "custom") return t("subtitlePositionCustom");
    return t("subtitlePositionBottom");
  }

  function setSubtitlePositionMode(mode) {
    const next = ["bottom", "top", "custom"].includes(mode) ? mode : "bottom";
    state.subtitlePositionMode = next;
    void persistSubtitlePositionMode(next);
    if (next !== "custom") {
      state.subtitleDragActive = false;
    } else {
      videoOverlay.classList.add("ankiouo-draggable");
    }
    if (state.trackedVideo) {
      positionOverlayToVideo(state.trackedVideo);
    }
    setStatus(t("statusSubtitlePositionChanged", { position: getSubtitlePositionLabel() }));
  }

  function resetCustomSubtitlePosition() {
    state.customSubtitleX = null;
    state.customSubtitleY = null;
    void persistCustomSubtitleY("");
    if (state.trackedVideo) {
      positionOverlayToVideo(state.trackedVideo);
    }
    setStatus(t("statusSubtitlePositionReset"));
  }

  function getSubtitleOffsetSeconds() {
    return Number(state.subtitleOffsetMs || 0) / 1000;
  }

  function formatSubtitleOffsetLabel() {
    const seconds = getSubtitleOffsetSeconds();
    const sign = seconds >= 0 ? "+" : "";
    return `${sign}${seconds.toFixed(1)}s`;
  }

  function setSubtitleOffsetSeconds(nextSeconds, options = {}) {
    const safeSeconds = Number(nextSeconds);
    const normalized = Number.isFinite(safeSeconds) ? safeSeconds : 0;
    state.subtitleOffsetMs = Math.round(normalized * 1000);
    if (subtitleOffsetInput) {
      subtitleOffsetInput.value = (state.subtitleOffsetMs / 1000).toFixed(1);
    }
    if (!options.silent) {
      setStatus(t("statusSubtitleOffsetChanged", { offset: formatSubtitleOffsetLabel() }));
    }
    if (state.subtitles.length) {
      state.cueRangeSelection = null;
      refreshSubtitleFromVideo(true);
    }
  }

  function beginSubtitleOffsetDrag(event) {
    if (!subtitleOffsetInput) return;
    state.subtitleOffsetDragPointerId = event.pointerId;
    state.subtitleOffsetDragStartY = event.clientY;
    state.subtitleOffsetDragStartSeconds = getSubtitleOffsetSeconds();
    state.subtitleOffsetDragActive = false;
    subtitleOffsetInput.setPointerCapture(event.pointerId);
  }

  function updateSubtitleOffsetDrag(event) {
    if (!subtitleOffsetInput || state.subtitleOffsetDragPointerId !== event.pointerId) return;
    const deltaY = state.subtitleOffsetDragStartY - event.clientY;
    if (!state.subtitleOffsetDragActive) {
      if (Math.abs(deltaY) < 12) {
        return;
      }
      state.subtitleOffsetDragActive = true;
      subtitleOffsetInput.blur();
    }
    event.preventDefault();
    const nextSeconds = state.subtitleOffsetDragStartSeconds + Math.round(deltaY / 8) * 0.1;
    setSubtitleOffsetSeconds(nextSeconds);
  }

  function endSubtitleOffsetDrag(event) {
    if (!subtitleOffsetInput || state.subtitleOffsetDragPointerId !== event.pointerId) return;
    state.subtitleOffsetDragPointerId = 0;
    state.subtitleOffsetDragActive = false;
    subtitleOffsetInput.releasePointerCapture(event.pointerId);
  }

  function getCueMediaWindow(cue) {
    const cueIndex = getCueIndex(cue);
    if (cueIndex >= 0) {
      return getCueMediaWindowFromIndices(cueIndex, cueIndex);
    }
    if (!cue) {
      return { start: 0, end: 0 };
    }
    const offset = getSubtitleOffsetSeconds();
    const start = Math.max(0, Number(cue.start || 0) + offset);
    const rawEnd = Number(cue.end || 0) + offset;
    const end = Math.max(start + 0.05, rawEnd);
    return { start, end };
  }

  function getCueIdentity(cue) {
    if (!cue) return "";
    return `${Number(cue.start || 0)}|${Number(cue.end || 0)}|${String(cue.text || "")}`;
  }

  function getCueIndex(cue) {
    if (!cue || !Array.isArray(state.subtitles) || !state.subtitles.length) {
      return -1;
    }
    const byRef = state.subtitles.indexOf(cue);
    if (byRef >= 0) return byRef;
    const identity = getCueIdentity(cue);
    if (!identity) return -1;
    return state.subtitles.findIndex((item) => getCueIdentity(item) === identity);
  }

  function getCueMediaWindowFromIndices(startIndex, endIndex) {
    const total = Array.isArray(state.subtitles) ? state.subtitles.length : 0;
    if (!total) return { start: 0, end: 0 };
    const normalizedStart = Math.max(0, Math.min(total - 1, Number(startIndex || 0)));
    const normalizedEnd = Math.max(normalizedStart, Math.min(total - 1, Number(endIndex || normalizedStart)));
    const firstCue = state.subtitles[normalizedStart];
    const lastCue = state.subtitles[normalizedEnd];
    const offset = getSubtitleOffsetSeconds();
    const start = Math.max(0, Number(firstCue && firstCue.start ? firstCue.start : 0) + offset);
    const rawEnd = Number(lastCue && lastCue.end ? lastCue.end : start) + offset;
    const end = Math.max(start + 0.05, rawEnd);
    return { start, end };
  }

  function findCueIndexByIdentity(anchorKey) {
    const key = String(anchorKey || "");
    if (!key || !Array.isArray(state.subtitles) || !state.subtitles.length) {
      return -1;
    }
    for (let index = 0; index < state.subtitles.length; index += 1) {
      if (getCueIdentity(state.subtitles[index]) === key) {
        return index;
      }
    }
    return -1;
  }

  function isRangePopupOpen() {
    return !!(rangePopup && !rangePopup.classList.contains("ankiouo-hidden"));
  }

  function getRangeAnchorCue() {
    if (isRangePopupOpen() && state.rangePopupAnchorKey) {
      const lockedIndex = findCueIndexByIdentity(state.rangePopupAnchorKey);
      if (lockedIndex >= 0) {
        return state.subtitles[lockedIndex] || null;
      }
    }
    return state.activeCue || null;
  }

  function setCueRangeSelection(startIndex, endIndex, anchorCue = getRangeAnchorCue()) {
    const anchorIndex = getCueIndex(anchorCue);
    if (anchorIndex < 0) {
      state.cueRangeSelection = null;
      return;
    }
    const total = state.subtitles.length;
    const safeStart = Math.max(0, Math.min(total - 1, Number(startIndex)));
    const safeEnd = Math.max(0, Math.min(total - 1, Number(endIndex)));
    state.cueRangeSelection = {
      anchorKey: getCueIdentity(anchorCue),
      startIndex: Math.min(safeStart, safeEnd),
      endIndex: Math.max(safeStart, safeEnd)
    };
  }

  function getCurrentCueExportRange() {
    const cue = getRangeAnchorCue();
    const anchorIndex = getCueIndex(cue);
    if (anchorIndex < 0) return null;
    const total = state.subtitles.length;
    let startIndex = anchorIndex;
    let endIndex = anchorIndex;
    const selection = state.cueRangeSelection;
    if (
      selection &&
      selection.anchorKey &&
      cue &&
      selection.anchorKey === getCueIdentity(cue)
    ) {
      startIndex = Math.max(0, Math.min(total - 1, Number(selection.startIndex)));
      endIndex = Math.max(0, Math.min(total - 1, Number(selection.endIndex)));
      if (startIndex > endIndex) {
        const tmp = startIndex;
        startIndex = endIndex;
        endIndex = tmp;
      }
    }
    const cues = state.subtitles.slice(startIndex, endIndex + 1);
    const sentence = cues
      .map((item) => String(item && item.text ? item.text : "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      anchorIndex,
      startIndex,
      endIndex,
      cues,
      sentence
    };
  }

  function getRangePanelWindow() {
    const cue = getRangeAnchorCue();
    const anchorIndex = getCueIndex(cue);
    if (!cue || anchorIndex < 0) {
      return null;
    }
    const windowSize = 5;
    let windowStart = Math.max(0, anchorIndex - 2);
    let windowEnd = Math.min(state.subtitles.length - 1, windowStart + windowSize - 1);
    windowStart = Math.max(0, windowEnd - (windowSize - 1));
    const selection = getCurrentCueExportRange();
    const selectedStart = selection ? selection.startIndex : anchorIndex;
    const selectedEnd = selection ? selection.endIndex : anchorIndex;
    const localStart = Math.max(0, selectedStart - windowStart);
    const localEnd = Math.max(localStart, selectedEnd - windowStart);
    const localMax = Math.max(0, windowEnd - windowStart);
    const boundaryWindow = getCueMediaWindowFromIndices(windowStart, windowEnd);
    return {
      cue,
      selection,
      windowStart,
      windowEnd,
      localStart,
      localEnd,
      localMax,
      boundaryStart: Number(boundaryWindow.start || 0),
      boundaryEnd: Number(boundaryWindow.end || 0)
    };
  }

  function updateRangeSliderFill() {
    if (!rangeSliderFill || !rangeStartInput || !rangeEndInput || !rangeSliderWrap) return;
    const min = Number(rangeStartInput.min || 0);
    const max = Math.max(min + 1, Number(rangeStartInput.max || 0));
    const span = Math.max(1, max - min);
    const leftValue = Math.min(Number(rangeStartInput.value || 0), Number(rangeEndInput.value || 0));
    const rightValue = Math.max(Number(rangeStartInput.value || 0), Number(rangeEndInput.value || 0));
    const trackInset = 12;
    const handleRadius = 12;
    const trackWidth = Math.max(0, rangeSliderWrap.clientWidth - trackInset * 2);
    const leftRatio = (leftValue - min) / span;
    const rightRatio = (rightValue - min) / span;
    const leftPx = trackInset + trackWidth * leftRatio;
    const rightPx = trackInset + trackWidth * rightRatio;
    rangeSliderFill.style.left = `${leftPx}px`;
    rangeSliderFill.style.width = `${Math.max(0, rightPx - leftPx)}px`;
    if (rangeStartHandle) {
      rangeStartHandle.style.left = `${leftPx - handleRadius}px`;
    }
    if (rangeEndHandle) {
      rangeEndHandle.style.left = `${rightPx - handleRadius}px`;
    }
  }

  function renderRangePopup() {
    if (!rangePopup || !rangeStatus || !rangeStartInput || !rangeEndInput || !rangeCueChips) return;
    const context = getRangePanelWindow();
    if (!context) {
      debugRange("renderEmpty");
      rangeStatus.textContent = t("statusRangeEmpty");
      rangeStartInput.disabled = true;
      rangeEndInput.disabled = true;
      rangeStartInput.min = "0";
      rangeStartInput.max = "0";
      rangeEndInput.min = "0";
      rangeEndInput.max = "0";
      rangeStartInput.value = "0";
      rangeEndInput.value = "0";
      clearElement(rangeCueChips);
      updateRangeSliderFill();
      return;
    }

    const boundaryMin = 0;
    const boundaryMax = context.localMax + 1;
    let selectedStartBoundary = context.localStart;
    let selectedEndBoundary = context.localEnd + 1;
    if (context.selection) {
      selectedStartBoundary = Math.max(boundaryMin, context.selection.startIndex - context.windowStart);
      selectedEndBoundary = Math.min(boundaryMax, context.selection.endIndex - context.windowStart + 1);
    }
    if (selectedEndBoundary <= selectedStartBoundary) {
      selectedEndBoundary = Math.min(boundaryMax, selectedStartBoundary + 1);
    }

    rangeStartInput.disabled = false;
    rangeEndInput.disabled = false;
    rangeStartInput.min = String(boundaryMin);
    rangeStartInput.max = String(boundaryMax);
    rangeEndInput.min = String(boundaryMin);
    rangeEndInput.max = String(boundaryMax);
    rangeStartInput.step = "1";
    rangeEndInput.step = "1";
    rangeStartInput.value = String(selectedStartBoundary);
    rangeEndInput.value = String(selectedEndBoundary);
    debugRange("renderReady", {
      windowStart: context.windowStart,
      windowEnd: context.windowEnd,
      selectedStartBoundary,
      selectedEndBoundary,
      selectedSentence: context.selection && context.selection.sentence ? context.selection.sentence : String(context.cue && context.cue.text ? context.cue.text : "")
    });
    updateRangeSliderFill();

    const selectedSentence =
      context.selection && context.selection.sentence
        ? context.selection.sentence
        : String(context.cue.text || "");
    rangeStatus.textContent = selectedSentence || t("emptyLabel");

    clearElement(rangeCueChips);
    for (let index = context.windowStart; index <= context.windowEnd; index += 1) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ankiouo-cue-chip";
      if (
        context.selection &&
        index >= context.selection.startIndex &&
        index <= context.selection.endIndex
      ) {
        chip.classList.add("ankiouo-cue-chip-active");
      }
      const cueText = String((state.subtitles[index] && state.subtitles[index].text) || "")
        .replace(/\s+/g, " ")
        .trim();
      chip.dataset.cueIndex = String(index);
      chip.textContent = cueText || t("emptyLabel");
      chip.title = cueText || t("emptyLabel");
      chip.addEventListener("click", () => {
        const localIndex = index - context.windowStart;
        const leftPos = Number(rangeStartInput.value || 0);
        const rightPos = Number(rangeEndInput.value || 0);
        const distanceToLeft = Math.abs(localIndex - leftPos);
        const distanceToRight = Math.abs(localIndex + 1 - rightPos);
        const moveLeft = localIndex < leftPos || (localIndex < rightPos && distanceToLeft < distanceToRight);
        debugRange("cueChipClick", {
          index,
          localIndex,
          leftPos,
          rightPos,
          distanceToLeft,
          distanceToRight,
          moveLeft
        });
        if (moveLeft) {
          rangeStartInput.value = String(Math.min(localIndex, Math.max(boundaryMin, rightPos - 1)));
        } else {
          rangeEndInput.value = String(Math.max(localIndex + 1, leftPos + 1));
        }
        applyRangePopupSelection();
      });
      rangeCueChips.appendChild(chip);
    }
  }

  function syncRangePopupSelectionState() {
    const context = getRangePanelWindow();
    const selection = getCurrentCueExportRange();
    if (rangeStatus) {
      rangeStatus.textContent =
        selection && selection.sentence
          ? selection.sentence
          : context && context.cue
            ? String(context.cue.text || "")
            : t("statusRangeEmpty");
    }
    if (rangeCueChips) {
      [...rangeCueChips.querySelectorAll(".ankiouo-cue-chip")].forEach((chip) => {
        const index = Number(chip.dataset.cueIndex || -1);
        const active =
          selection &&
          Number.isFinite(index) &&
          index >= selection.startIndex &&
          index <= selection.endIndex;
        chip.classList.toggle("ankiouo-cue-chip-active", !!active);
      });
    }
    updateRangeSliderFill();
  }

  function applyRangePopupSelection() {
    const context = getRangePanelWindow();
    if (!context || !rangeStartInput || !rangeEndInput) return;
    let startBoundary = Number(rangeStartInput.value || 0);
    let endBoundary = Number(rangeEndInput.value || 0);
    if (startBoundary > endBoundary) {
      const tmp = startBoundary;
      startBoundary = endBoundary;
      endBoundary = tmp;
    }
    startBoundary = Math.max(0, Math.min(context.localMax, Math.round(startBoundary)));
    endBoundary = Math.max(startBoundary + 1, Math.min(context.localMax + 1, Math.round(endBoundary)));
    rangeStartInput.value = String(startBoundary);
    rangeEndInput.value = String(endBoundary);

    const startIndex = context.windowStart + startBoundary;
    const endIndex = Math.min(context.windowEnd, context.windowStart + endBoundary - 1);
    setCueRangeSelection(startIndex, endIndex, state.activeCue);
    syncRangePopupSelectionState();
  }

  function openRangePopup() {
    if (!rangePopup) return;
    const context = getRangePanelWindow();
    state.rangePopupAnchorKey = getCueIdentity(state.activeCue);
    debugRange("openRequest", {
      hasContext: !!context,
      anchorKey: state.rangePopupAnchorKey
    });
    if (context) {
      const anchorIndex = context.selection ? context.selection.anchorIndex : getCueIndex(state.activeCue);
      const defaultStart = Math.max(context.windowStart, anchorIndex);
      const defaultEnd = Math.min(context.windowEnd, anchorIndex);
      setCueRangeSelection(defaultStart, defaultEnd, getRangeAnchorCue());
    }
    rangePopup.classList.remove("ankiouo-hidden");
    renderRangePopup();
    window.requestAnimationFrame(() => {
      if (!rangePopup || rangePopup.classList.contains("ankiouo-hidden")) return;
      syncRangePopupSelectionState();
    });
  }

  function closeRangePopup() {
    if (!rangePopup) return;
    debugRange("close");
    state.rangePopupAnchorKey = "";
    rangePopup.classList.add("ankiouo-hidden");
  }

  function isCodePointKana(codePoint) {
    return (
      (codePoint >= 0x3040 && codePoint <= 0x309f) ||
      (codePoint >= 0x30a0 && codePoint <= 0x30ff)
    );
  }

  function convertKatakanaToHiragana(text, keepProlongedSoundMarks = false) {
    const source = String(text || "");
    let result = "";
    for (let i = 0; i < source.length; i += 1) {
      let char = source[i];
      const codePoint = char.codePointAt(0);
      if (!codePoint) continue;
      if (codePoint === 0x30fc && !keepProlongedSoundMarks && result.length > 0) {
        const previous = result[result.length - 1];
        const mapping = {
          あ: "あ", か: "あ", が: "あ", さ: "あ", ざ: "あ", た: "あ", だ: "あ", な: "あ", は: "あ", ば: "あ", ぱ: "あ", ま: "あ", や: "あ", ら: "あ", わ: "あ",
          ぁ: "あ", ゃ: "あ",
          い: "い", き: "い", ぎ: "い", し: "い", じ: "い", ち: "い", ぢ: "い", に: "い", ひ: "い", び: "い", ぴ: "い", み: "い", り: "い",
          ぃ: "い",
          う: "う", く: "う", ぐ: "う", す: "う", ず: "う", つ: "う", づ: "う", ぬ: "う", ふ: "う", ぶ: "う", ぷ: "う", む: "う", ゆ: "う", る: "う",
          ぅ: "う", ゅ: "う",
          え: "え", け: "え", げ: "え", せ: "え", ぜ: "え", て: "え", で: "え", ね: "え", へ: "え", べ: "え", ぺ: "え", め: "え", れ: "え",
          ぇ: "え",
          お: "お", こ: "お", ご: "お", そ: "お", ぞ: "お", と: "お", ど: "お", の: "お", ほ: "お", ぼ: "お", ぽ: "お", も: "お", よ: "お", ろ: "お",
          ぉ: "お", ょ: "お"
        };
        char = mapping[previous] || char;
      } else if (codePoint >= 0x30a1 && codePoint <= 0x30f6) {
        char = String.fromCodePoint(codePoint - 0x60);
      }
      result += char;
    }
    return result;
  }

  function createFuriganaSegment(text, reading) {
    return { text, reading };
  }

  function getFuriganaKanaSegments(text, reading) {
    const textLength = text.length;
    const segments = [];
    let start = 0;
    let state = reading[0] === text[0];
    for (let i = 1; i < textLength; i += 1) {
      const nextState = reading[i] === text[i];
      if (state === nextState) continue;
      segments.push(createFuriganaSegment(text.substring(start, i), state ? "" : reading.substring(start, i)));
      state = nextState;
      start = i;
    }
    segments.push(createFuriganaSegment(text.substring(start, textLength), state ? "" : reading.substring(start, textLength)));
    return segments;
  }

  function segmentizeFurigana(reading, readingNormalized, groups, groupsStart) {
    const groupCount = groups.length - groupsStart;
    if (groupCount <= 0) {
      return reading.length === 0 ? [] : null;
    }
    const group = groups[groupsStart];
    const { isKana, text } = group;
    const textLength = text.length;
    if (isKana) {
      const { textNormalized } = group;
      if (textNormalized !== null && readingNormalized.startsWith(textNormalized)) {
        const segments = segmentizeFurigana(
          reading.substring(textLength),
          readingNormalized.substring(textLength),
          groups,
          groupsStart + 1
        );
        if (segments !== null) {
          if (reading.startsWith(text)) {
            segments.unshift(createFuriganaSegment(text, ""));
          } else {
            segments.unshift(...getFuriganaKanaSegments(text, reading.substring(0, textLength)));
          }
          return segments;
        }
      }
      return null;
    }
    let result = null;
    for (let i = reading.length; i >= textLength; i -= 1) {
      const segments = segmentizeFurigana(
        reading.substring(i),
        readingNormalized.substring(i),
        groups,
        groupsStart + 1
      );
      if (segments !== null) {
        if (result !== null) {
          return null;
        }
        const segmentReading = reading.substring(0, i);
        segments.unshift(createFuriganaSegment(text, segmentReading));
        result = segments;
      }
      if (groupCount === 1) {
        break;
      }
    }
    return result;
  }

  function distributeFurigana(term, reading) {
    const termText = String(term || "").trim();
    const readingText = String(reading || "").trim();
    if (!termText) return [];
    if (!readingText || readingText === termText) {
      return [createFuriganaSegment(termText, "")];
    }
    const groups = [];
    let groupPre = null;
    let isKanaPre = null;
    for (const char of termText) {
      const codePoint = char.codePointAt(0);
      const isKana = Boolean(codePoint && isCodePointKana(codePoint));
      if (isKana === isKanaPre) {
        groupPre.text += char;
      } else {
        groupPre = { isKana, text: char, textNormalized: null };
        groups.push(groupPre);
        isKanaPre = isKana;
      }
    }
    groups.forEach((group) => {
      if (group.isKana) {
        group.textNormalized = convertKatakanaToHiragana(group.text);
      }
    });
    const readingNormalized = convertKatakanaToHiragana(readingText);
    return segmentizeFurigana(readingText, readingNormalized, groups, 0) || [createFuriganaSegment(termText, readingText)];
  }

  function isReadingEquivalent(term, reading) {
    const left = convertKatakanaToHiragana(String(term || "").trim());
    const right = convertKatakanaToHiragana(String(reading || "").trim());
    return Boolean(left && right && left === right);
  }

  function hasRubySegments(segments) {
    return (Array.isArray(segments) ? segments : []).some((segment) => segment && segment.reading);
  }

  function createFuriganaNode(expression, reading = "") {
    const expressionText = String(expression || "").trim();
    const readingText = String(reading || "").trim();
    const container = document.createElement("span");
    const segments = distributeFurigana(expressionText, readingText);
    if (!segments.length) {
      container.textContent = readingText || expressionText;
      return container;
    }
    segments.forEach(({ text, reading: furigana }) => {
      if (furigana) {
        const ruby = document.createElement("ruby");
        ruby.appendChild(document.createTextNode(text));
        const rt = document.createElement("rt");
        rt.textContent = furigana;
        ruby.appendChild(rt);
        container.appendChild(ruby);
      } else {
        container.appendChild(document.createTextNode(text));
      }
    });
    return container;
  }

  function normalizeDictionaryLabel(text) {
    return String(text || "").trim().replace(/^\((.*)\)$/, "$1");
  }

  function decorateYomitanGlossary(container) {
    if (!container) return;
    container.querySelectorAll(".yomitan-glossary li[data-dictionary] > i").forEach((node) => {
      const label = normalizeDictionaryLabel(node.textContent || "");
      node.textContent = label;
      node.classList.add("ankiouo-dictionary-badge");
    });
  }

  function createEmptyMessage(message) {
    const node = document.createElement("div");
    node.className = "ankiouo-empty";
    node.textContent = String(message || "");
    return node;
  }

  function clearElement(element) {
    if (element) {
      element.replaceChildren();
    }
  }

  function pushSwipeDebugLog(kind, details = {}) {
    const entry = {
      at: new Date().toISOString(),
      kind,
      ...details
    };
    state.swipeDebugEvents.push(entry);
    if (state.swipeDebugEvents.length > SWIPE_DEBUG_LOG_MAX) {
      state.swipeDebugEvents.splice(0, state.swipeDebugEvents.length - SWIPE_DEBUG_LOG_MAX);
    }
    try {
      window.__vouoaSwipeDebug = state.swipeDebugEvents.slice();
      console.debug("[VouoA swipe]", entry);
    } catch (error) {}
  }

  function setEmptyMessage(target, message) {
    if (!target) return;
    target.replaceChildren(createEmptyMessage(message));
  }

  function showResultsEmpty(message, target = results) {
    setEmptyMessage(target, message);
  }

  function beginLookupRequest(query, target = popupResults, contextKey = "") {
    state.lookupRequestId += 1;
    state.currentResults = [];
    state.lastLookupEntry = null;
    state.currentLookupToken = String(query || "").trim();
    state.currentLookupSurface = "";
    state.currentLookupClozeContext = null;
    state.lookupRequestContext = String(contextKey || "");
    showResultsEmpty(t("statusLookupLoadingDesktop"), target);
    return state.lookupRequestId;
  }

  function invalidateLookupRequestState() {
    state.lookupRequestId += 1;
    state.lookupRequestContext = "";
  }

  function isActiveLookupRequest(requestId, contextKey = "") {
    if (requestId !== state.lookupRequestId) return false;
    const expectedContext = String(contextKey || "");
    return !expectedContext || expectedContext === String(state.lookupRequestContext || "");
  }

  function showSubtitleEmpty(message) {
    setEmptyMessage(subtitleStage, message);
    setEmptyMessage(videoSubtitleStage, message);
  }

  function hideSubtitleOverlay() {
    if (state.subtitleOverlayHidden) return;
    state.subtitleOverlayHidden = true;
    setQuickSubtitleButtonLabel();
    setStatus(t("statusSubtitleOverlayHidden"));
  }

  function showSubtitleOverlay() {
    if (!state.subtitleOverlayHidden) return;
    state.subtitleOverlayHidden = false;
    setQuickSubtitleButtonLabel();
    setStatus(t("statusSubtitleOverlayShown"));
  }

  function getBestVideoCandidate() {
    const videos = Array.from(document.querySelectorAll("video"));
    if (!videos.length) {
      return null;
    }

    const visibleVideos = videos
      .filter((video) => {
        const rect = video.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .sort((left, right) => {
        const leftRect = left.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();
        return rightRect.width * rightRect.height - leftRect.width * leftRect.height;
      });

    return visibleVideos[0] || videos[0];
  }

  function isVideoVisible(video) {
    if (!video || typeof video.getBoundingClientRect !== "function") {
      return false;
    }
    const rect = video.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function formatProbeLines(lines) {
    return lines.join("\n");
  }

  function getFirstAudioFromPlayinfo(playinfo) {
    if (!playinfo || typeof playinfo !== "object") {
      return null;
    }

    const candidate =
      (playinfo.data && playinfo.data.dash) ||
      playinfo.dash ||
      (playinfo.result && playinfo.result.dash) ||
      (playinfo.result && playinfo.result.video_info && playinfo.result.video_info.dash) ||
      null;

    if (!candidate || !Array.isArray(candidate.audio) || !candidate.audio.length) {
      return null;
    }

    const firstAudio = candidate.audio[0];
    return {
      id: firstAudio.id,
      baseUrl: firstAudio.baseUrl || firstAudio.base_url || "",
      backupUrl:
        Array.isArray(firstAudio.backupUrl) && firstAudio.backupUrl.length
          ? firstAudio.backupUrl[0]
          : Array.isArray(firstAudio.backup_url) && firstAudio.backup_url.length
            ? firstAudio.backup_url[0]
            : "",
      bandwidth: firstAudio.bandwidth || "",
      codecs: firstAudio.codecs || ""
    };
  }

  async function resolveBilibiliAudioInfo() {
    const response = await fetch(location.href, { credentials: "include" });
    const html = await response.text();
    const playinfo = extractPlayinfoFromHtml(html);
    const audio = getFirstAudioFromPlayinfo(playinfo);

    return {
      html,
      playinfo,
      audio
    };
  }

  function releaseAudioClipUrl() {
    if (state.audioClipUrl) {
      try {
        URL.revokeObjectURL(state.audioClipUrl);
      } catch (error) {}
      state.audioClipUrl = "";
    }
    state.audioClipFilename = "";
    state.audioClipDataUrl = "";
    state.audioClipMime = "";
  }

  function rememberSourceAudioInfo(audioInfo) {
    state.sourceAudioUrl = audioInfo && audioInfo.baseUrl ? String(audioInfo.baseUrl) : "";
    state.sourceAudioBackupUrl = audioInfo && audioInfo.backupUrl ? String(audioInfo.backupUrl) : "";
    state.sourceAudioCodecs = audioInfo && audioInfo.codecs ? String(audioInfo.codecs) : "";
  }

  function buildSourceAudioSnapshot(audioInfo) {
    return {
      sourceAudioUrl: audioInfo && audioInfo.baseUrl ? String(audioInfo.baseUrl) : "",
      sourceAudioBackupUrl: audioInfo && audioInfo.backupUrl ? String(audioInfo.backupUrl) : "",
      sourceAudioCodecs: audioInfo && audioInfo.codecs ? String(audioInfo.codecs) : ""
    };
  }

  function releaseScreenshotUrl() {
    if (state.screenshotUrl) {
      try {
        URL.revokeObjectURL(state.screenshotUrl);
      } catch (error) {}
      state.screenshotUrl = "";
      state.screenshotFilename = "";
      state.screenshotDataUrl = "";
    }
  }

  function getAudioContextInstance() {
    const AudioContextClass =
      (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) || null;

    if (!AudioContextClass) {
      throw new Error("AudioContext is not available.");
    }

    return new AudioContextClass();
  }

  function audioBufferToWavBlob(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const frameCount = audioBuffer.length;
    const blockAlign = numberOfChannels * bytesPerSample;
    const buffer = new ArrayBuffer(44 + frameCount * blockAlign);
    const view = new DataView(buffer);
    let offset = 0;

    function writeString(value) {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset, value.charCodeAt(index));
        offset += 1;
      }
    }

    function writeUint16(value) {
      view.setUint16(offset, value, true);
      offset += 2;
    }

    function writeUint32(value) {
      view.setUint32(offset, value, true);
      offset += 4;
    }

    writeString("RIFF");
    writeUint32(36 + frameCount * blockAlign);
    writeString("WAVE");
    writeString("fmt ");
    writeUint32(16);
    writeUint16(1);
    writeUint16(numberOfChannels);
    writeUint32(sampleRate);
    writeUint32(sampleRate * blockAlign);
    writeUint16(blockAlign);
    writeUint16(bitDepth);
    writeString("data");
    writeUint32(frameCount * blockAlign);

    const channelData = [];
    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      channelData.push(audioBuffer.getChannelData(channel));
    }

    for (let frame = 0; frame < frameCount; frame += 1) {
      for (let channel = 0; channel < numberOfChannels; channel += 1) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][frame] || 0));
        const intSample = sample < 0 ? sample * 32768 : sample * 32767;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  async function audioBufferToPreferredBlob(audioBuffer) {
    const supportsMediaRecorder = typeof window.MediaRecorder !== "undefined";
    const AudioContextClass =
      (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) || null;
    const preferredMimeTypes = ["audio/mp4", "audio/aac"];

    if (supportsMediaRecorder && AudioContextClass) {
      const preferredMimeType = preferredMimeTypes.find((mimeType) =>
        typeof MediaRecorder.isTypeSupported === "function" ? MediaRecorder.isTypeSupported(mimeType) : false
      );

      if (preferredMimeType) {
        const offlineContext = new AudioContextClass();
        const destination = offlineContext.createMediaStreamDestination();
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(destination);

        const chunks = [];

        try {
          const blob = await new Promise((resolve, reject) => {
            let recorder;

            try {
              recorder = new MediaRecorder(destination.stream, { mimeType: preferredMimeType });
            } catch (error) {
              reject(error);
              return;
            }

            recorder.ondataavailable = (event) => {
              if (event.data && event.data.size > 0) {
                chunks.push(event.data);
              }
            };

            recorder.onerror = (event) => {
              const error = event && event.error ? event.error : new Error("MediaRecorder error");
              reject(error);
            };

            recorder.onstop = () => {
              if (!chunks.length) {
                reject(new Error("No encoded audio data produced."));
                return;
              }
              resolve(new Blob(chunks, { type: preferredMimeType }));
            };

            source.onended = () => {
              if (recorder.state !== "inactive") {
                recorder.stop();
              }
            };

            recorder.start();
            source.start();
          });

          if (typeof offlineContext.close === "function") {
            offlineContext.close().catch(() => {});
          }

          return {
            blob,
            mimeType: preferredMimeType,
            extension: preferredMimeType === "audio/mp4" ? "m4a" : "aac"
          };
        } catch (error) {
          if (typeof offlineContext.close === "function") {
            offlineContext.close().catch(() => {});
          }
        }
      }
    }

    return {
      blob: audioBufferToWavBlob(audioBuffer),
      mimeType: "audio/wav",
      extension: "wav"
    };
  }

  function sliceAudioBuffer(audioBuffer, startSeconds, endSeconds) {
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.max(0, Math.floor(startSeconds * sampleRate));
    const endSample = Math.max(startSample + 1, Math.min(audioBuffer.length, Math.ceil(endSeconds * sampleRate)));
    const frameCount = Math.max(1, endSample - startSample);
    const sliced = new AudioBuffer({
      length: frameCount,
      numberOfChannels: audioBuffer.numberOfChannels,
      sampleRate
    });

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const source = audioBuffer.getChannelData(channel).subarray(startSample, endSample);
      sliced.copyToChannel(source, channel, 0);
    }

    return sliced;
  }

  function formatTimeTag(seconds) {
    return Number(seconds || 0).toFixed(2).replace(".", "_");
  }

  function makeCueFileBase(cue, fallback) {
    const safeName = String((cue && cue.text) || fallback || "subtitle-media")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 32);
    const base = safeName || "subtitle-media";
    const start = cue ? formatTimeTag(cue.start) : "0_00";
    const end = cue ? formatTimeTag(cue.end) : "0_00";
    return `${base}_${start}-${end}`;
  }

  function addFakePathToUrl(url, filename) {
    const source = String(url || "");
    if (!source) {
      return "";
    }

    if (/[\?&]fakePath=/i.test(source)) {
      return source;
    }

    const separator = source.indexOf("?") === -1 ? "?" : "&";
    return `${source}${separator}fakePath=${encodeURIComponent(filename)}`;
  }

  function extractPlayinfoFromHtml(html) {
    const patterns = [
      /window\.__playinfo__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/i,
      /window\.__PLAYINFO__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/i,
      /window\.__PLAYURL_HYDRATE_DATA__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/i
    ];

    for (let index = 0; index < patterns.length; index += 1) {
      const match = html.match(patterns[index]);
      if (!match || !match[1]) {
        continue;
      }

      try {
        return JSON.parse(match[1]);
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  async function captureCurrentSubtitleScreenshot(options = {}) {
    const { updateState = true } = options;
    const cue = state.activeCue;
    const video = state.trackedVideo || getBestVideoCandidate();

    if (!video) {
      return { screenshotUrl: "", screenshotFilename: "", screenshotDataUrl: "", screenshotMime: "" };
    }

    const width = video.videoWidth || video.clientWidth || 0;
    const height = video.videoHeight || video.clientHeight || 0;
    if (!width || !height) {
      return { screenshotUrl: "", screenshotFilename: "", screenshotDataUrl: "", screenshotMime: "" };
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas 2D context is not available.");
      }

      context.drawImage(video, 0, 0, width, height);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((value) => {
          if (value) {
            resolve(value);
            return;
          }
          reject(new Error("Canvas export failed."));
        }, "image/jpeg", 0.92);
      });

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Screenshot data URL conversion failed."));
        reader.readAsDataURL(blob);
      });

      const screenshotFilename = `${makeCueFileBase(cue, `subtitle-shot-${formatTimeTag(video.currentTime || 0)}`)}.jpg`;
      const screenshotUrl = URL.createObjectURL(blob);
      if (updateState) {
        releaseScreenshotUrl();
        state.screenshotUrl = screenshotUrl;
        state.screenshotFilename = screenshotFilename;
        state.screenshotDataUrl = dataUrl;
      }
      return {
        screenshotUrl,
        screenshotFilename,
        screenshotDataUrl: dataUrl,
        screenshotMime: "image/jpeg"
      };
    } catch (error) {
      return {
        screenshotUrl: "",
        screenshotFilename: "",
        screenshotDataUrl: "",
        screenshotMime: ""
      };
    }
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("File read failed."));
      reader.readAsText(file, "utf-8");
    });
  }

  function sanitizeClassName(value) {
    return String(value || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((name) => name.replace(/[^\w-]/g, ""))
      .filter(Boolean)
      .join(" ");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeHtmlAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  function createStructuredNode(node) {
    if (node == null) {
      return document.createTextNode("");
    }

    if (typeof node === "string") {
      return document.createTextNode(node);
    }

    if (Array.isArray(node)) {
      const fragment = document.createDocumentFragment();
      node.forEach((item) => fragment.appendChild(createStructuredNode(item)));
      return fragment;
    }

    if (node.type === "structured-content") {
      return createStructuredNode(node.content);
    }

    const allowedTags = new Set(["div", "span", "br", "p", "ul", "ol", "li", "table", "tbody", "thead", "tr", "td", "th", "ruby", "rt", "rp", "strong", "em", "b", "i"]);
    const tagName = allowedTags.has(node.tag) ? node.tag : "span";
    const element = document.createElement(tagName);

    if (node.data && node.data.class) {
      element.className = sanitizeClassName(node.data.class);
    }

    if (node.lang) {
      element.lang = node.lang;
    }

    if (node.content != null) {
      element.appendChild(createStructuredNode(node.content));
    }

    return element;
  }

  function structuredNodeToHtml(node, mode = "current") {
    if (node == null) {
      return "";
    }

    if (typeof node === "string") {
      return escapeHtml(node);
    }

    if (Array.isArray(node)) {
      return node.map((item) => structuredNodeToHtml(item, mode)).join("");
    }

    if (node.type === "structured-content") {
      return structuredNodeToHtml(node.content, mode);
    }

    const allowedTags = new Set(["div", "span", "br", "p", "ul", "ol", "li", "table", "tbody", "thead", "tr", "td", "th", "ruby", "rt", "rp", "strong", "em", "b", "i"]);
    const tagName = allowedTags.has(node.tag) ? node.tag : "span";
    const attributes = [];
    const data = node.data || {};

    if (data.class) {
      const cleaned = sanitizeClassName(data.class);
      if (cleaned) {
        attributes.push(`class="${escapeHtmlAttr(cleaned)}"`);
      }
    }

    Object.entries(data).forEach(([key, value]) => {
      if (key === "class" || value == null || value === "") {
        return;
      }
      const normalizedKey = key.startsWith("data-") ? key : `data-${key}`;
      attributes.push(`${normalizedKey}="${escapeHtmlAttr(value)}"`);
    });

    if (node.lang) {
      attributes.push(`lang="${escapeHtmlAttr(node.lang)}"`);
    }

    if (tagName === "br") {
      return `<br${attributes.length ? " " + attributes.join(" ") : ""}>`;
    }

    const innerHtml = node.content != null ? structuredNodeToHtml(node.content, mode) : "";
    return `<${tagName}${attributes.length ? " " + attributes.join(" ") : ""}>${innerHtml}</${tagName}>`;
  }

  function getGlossaryInlineCss(renderOptions = {}) {
    const { brief = false } = renderOptions || {};
    if (!brief) {
      return "";
    }
    return [
      `ul[data-sc-content="glossary"] > li:not(:first-child)::before {`,
      `  white-space: pre-wrap;`,
      `  content: ' | ';`,
      `  display: inline;`,
      `  color: #777777;`,
      `}`,
      ``,
      `ul[data-sc-content="glossary"] > li {`,
      `  display: inline;`,
      `}`,
      ``,
      `ul[data-sc-content="glossary"] {`,
      `  display: inline;`,
      `  list-style: none;`,
      `  padding-left: 0;`,
      `}`
    ].join("\n");
  }

  function glossaryToPlainText(glossary) {
    const texts = [];

    function visit(node) {
      if (node == null) {
        return;
      }

      if (typeof node === "string") {
        const cleaned = node.replace(/\s+/g, " ").trim();
        if (cleaned) {
          texts.push(cleaned);
        }
        return;
      }

      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }

      if (node.type === "structured-content") {
        visit(node.content);
        return;
      }

      visit(node.content);
    }

    visit(glossary);
    return [...new Set(texts)].join(" ").trim();
  }

  function glossaryToList(glossary) {
    const values = [];

    function visit(node) {
      if (node == null) {
        return;
      }

      if (typeof node === "string") {
        const cleaned = node.replace(/\s+/g, " ").trim();
        if (cleaned) {
          values.push(cleaned);
        }
        return;
      }

      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }

      if (node.type === "structured-content") {
        visit(node.content);
        return;
      }

      visit(node.content);
    }

    visit(glossary);
    return [...new Set(values)];
  }

  function extractFirstGlossaryItem(node) {
    if (node == null) {
      return null;
    }

    if (typeof node === "string") {
      return node.replace(/\s+/g, " ").trim() ? node : null;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const first = extractFirstGlossaryItem(item);
        if (first != null) {
          return first;
        }
      }
      return null;
    }

    if (node.type === "structured-content") {
      const first = extractFirstGlossaryItem(node.content);
      return first == null ? null : { ...node, content: first };
    }

    const tagName = String(node.tag || "").toLowerCase();
    if ((tagName === "ul" || tagName === "ol") && Array.isArray(node.content)) {
      const firstChild = extractFirstGlossaryItem(node.content);
      if (firstChild == null) {
        return null;
      }
      const normalizedChild =
        typeof firstChild === "object" && firstChild && String(firstChild.tag || "").toLowerCase() === "li"
          ? firstChild
          : { tag: "li", content: firstChild };
      return { ...node, content: [normalizedChild] };
    }

    if (node.content != null) {
      const first = extractFirstGlossaryItem(node.content);
      return first == null ? null : { ...node, content: first };
    }

    return node;
  }

  function glossaryToHtml(glossary, firstOnly = false, mode = "original", dictionaryTitle = "", renderOptions = {}) {
    const { hideDictionaryTitle = false, brief = false } = renderOptions || {};
    const selectedContent = firstOnly ? extractFirstGlossaryItem(glossary) : glossary;
    const values = Array.isArray(selectedContent) ? selectedContent : [selectedContent];
    const title = String(dictionaryTitle || "").trim();
    const css = getGlossaryInlineCss(renderOptions);
    const styleBlock = `<style>${css}</style>`;
    const renderedItems = values
      .map((item) => {
        if (typeof item === "string" && /<[a-z][\s\S]*>/i.test(item)) {
          return item;
        }
        return structuredNodeToHtml(item, mode);
      })
      .filter(Boolean);

    if (!renderedItems.length) {
      return glossaryToPlainText(glossary);
    }

    const joinedItems = brief ? compactGlossaryHtml(renderedItems.join("")) : renderedItems.join("");

    if (mode === "original") {
      if (firstOnly) {
        const dictionaryLabel = !hideDictionaryTitle && title ? `<i>(${escapeHtml(title)})</i> ` : "";
        return `<div style="text-align: left;" class="yomitan-glossary">${dictionaryLabel}${joinedItems}${styleBlock}</div>`;
      }
      if (title && !hideDictionaryTitle) {
        return `<div style="text-align: left;" class="yomitan-glossary"><ol><li data-dictionary="${escapeHtmlAttr(title)}"><i>(${escapeHtml(title)})</i> <span>${joinedItems}</span></li></ol>${styleBlock}</div>`;
      }
      return `<div style="text-align: left;" class="yomitan-glossary">${joinedItems}${styleBlock}</div>`;
    }

    const dictionaryBlock = !hideDictionaryTitle && title
      ? `<i>(${escapeHtml(title)})</i> `
      : "";
    return `<div style="text-align: left;" class="yomitan-glossary">${dictionaryBlock}${joinedItems}${styleBlock}</div>`;
  }

  function createClozeContextFromSpan(sentence, start, end, bodyKana = "") {
    const sourceSentence = String(sentence || "");
    const safeStart = Math.max(0, Math.min(sourceSentence.length, Number(start)));
    const safeEnd = Math.max(safeStart, Math.min(sourceSentence.length, Number(end)));
    const body = sourceSentence.slice(safeStart, safeEnd);
    return {
      sentence: sourceSentence,
      start: safeStart,
      end: safeEnd,
      prefix: sourceSentence.slice(0, safeStart),
      body,
      suffix: sourceSentence.slice(safeEnd),
      bodyKana: String(bodyKana || "")
    };
  }

  function collectEntryClozeCandidates(entry) {
    const candidates = [];
    const seen = new Set();
    const push = (value) => {
      const text = String(value || "").trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      candidates.push(text);
    };

    const sources = [];
    const raw = entry && entry.raw && typeof entry.raw === "object" ? entry.raw : null;
    const remoteFields = entry && entry.remoteFields && typeof entry.remoteFields === "object" ? entry.remoteFields : null;

    if (raw && Array.isArray(raw.headwords)) {
      raw.headwords.forEach((headword) => {
        if (headword && typeof headword === "object" && Array.isArray(headword.sources)) {
          headword.sources.forEach((source) => sources.push(source));
        }
      });
    }

    sources.forEach((source) => {
      if (!source || typeof source !== "object") return;
      push(source.originalText);
    });
    sources.forEach((source) => {
      if (!source || typeof source !== "object") return;
      push(source.transformedText);
    });
    sources.forEach((source) => {
      if (!source || typeof source !== "object") return;
      push(source.deinflectedText);
    });

    if (remoteFields) {
      push(remoteFields.rawSource);
      push(remoteFields.source);
      push(remoteFields.sourceTerm);
    }

    push(entry && entry.expression);
    return candidates;
  }

  function findSentenceMatchSpan(sentence, candidate, hintStart = -1) {
    const sourceSentence = String(sentence || "");
    const needle = String(candidate || "");
    if (!sourceSentence || !needle) return null;

    const matches = [];
    let searchIndex = 0;
    while (searchIndex <= sourceSentence.length) {
      const index = sourceSentence.indexOf(needle, searchIndex);
      if (index === -1) break;
      matches.push(index);
      searchIndex = index + Math.max(1, needle.length);
    }
    if (!matches.length) return null;
    if (matches.length === 1 || !Number.isFinite(Number(hintStart))) {
      return { start: matches[0], end: matches[0] + needle.length };
    }

    const target = Number(hintStart);
    let bestIndex = matches[0];
    let bestDistance = Math.abs(matches[0] - target);
    matches.forEach((index) => {
      const distance = Math.abs(index - target);
      if (distance < bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    });
    return { start: bestIndex, end: bestIndex + needle.length };
  }

  function resolveEntryClozeContext(sentence, entry, explicitContext = null) {
    const sourceSentence = String(sentence || "");
    const hintStart =
      explicitContext && Number.isFinite(Number(explicitContext.start)) ? Number(explicitContext.start) : -1;
    const candidates = collectEntryClozeCandidates(entry);
    for (const candidate of candidates) {
      const span = findSentenceMatchSpan(sourceSentence, candidate, hintStart);
      if (!span) continue;
      return createClozeContextFromSpan(sourceSentence, span.start, span.end);
    }
    return null;
  }

  function getClozeParts(sentence, lookupToken, alternatives = [], explicitContext = null) {
    const sourceSentence = sentence || "";
    if (
      explicitContext &&
      typeof explicitContext === "object" &&
      String(explicitContext.sentence || "") === String(sourceSentence || "") &&
      Number.isFinite(Number(explicitContext.start)) &&
      Number.isFinite(Number(explicitContext.end))
    ) {
      return createClozeContextFromSpan(
        sourceSentence,
        Number(explicitContext.start),
        Number(explicitContext.end),
        explicitContext.bodyKana || ""
      );
    }
    const base = String(lookupToken || queryInput.value.trim() || "");
    const candidates = [base, ...(Array.isArray(alternatives) ? alternatives : [])]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index);
    if (!sourceSentence || !candidates.length) {
      return {
        sentence: sourceSentence,
        start: sourceSentence.length,
        end: sourceSentence.length,
        prefix: sourceSentence,
        body: "",
        suffix: "",
        bodyKana: ""
      };
    }

    for (const body of candidates) {
      const index = sourceSentence.indexOf(body);
      if (index !== -1) {
        return createClozeContextFromSpan(sourceSentence, index, index + body.length);
      }
    }

    return {
      sentence: sourceSentence,
      start: sourceSentence.length,
      end: sourceSentence.length,
      prefix: sourceSentence,
      body: "",
      suffix: "",
      bodyKana: ""
    };
  }

  function escapeJsonStringValue(value) {
    return JSON.stringify(String(value == null ? "" : value)).slice(1, -1);
  }

  function renderAnkiTemplate(template, values) {
    return String(template || "").replace(/\{([^{}]+)\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(values, key) ? String(values[key] == null ? "" : values[key]) : match
    );
  }

  function renderGlossary(glossary, dictionaryTitle = "") {
    const container = document.createElement("div");
    container.className = "ankiouo-glossary";
    const source = String(glossary == null ? "" : glossary).trim();
    const nativeYomitanGlossary = Boolean(source && /class\s*=\s*["'][^"']*yomitan-glossary/i.test(source));
    if (nativeYomitanGlossary) {
      container.classList.add("ankiouo-glossary-native");
      container.innerHTML = source;
    } else {
      container.innerHTML = glossaryToHtml(glossary, false, "original", dictionaryTitle);
    }
    decorateYomitanGlossary(container);
    return container;
  }

  function compactGlossaryHtml(html) {
    const source = String(html || "").trim();
    if (!source || typeof document === "undefined" || !/<[a-z][\s\S]*>/i.test(source)) {
      return source;
    }
    const container = document.createElement("div");
    container.innerHTML = source;
    container.querySelectorAll("ul, ol").forEach((list) => {
      const items = Array.from(list.children)
        .filter((node) => node && String(node.tagName || "").toLowerCase() === "li")
        .map((item) => item.innerHTML.trim())
        .filter(Boolean);
      if (!items.length) return;
      const span = document.createElement("span");
      span.innerHTML = items.join(' <span class="gloss-separator">|</span> ');
      list.replaceWith(span);
    });
    return container.innerHTML;
  }

  function extractFirstDictionaryBlockFromGlossaryHtml(html, options = {}) {
    const { hideDictionaryTitle = false, brief = false } = options;
    const source = String(html || "").trim();
    if (!source || typeof document === "undefined" || !/<[a-z][\s\S]*>/i.test(source)) {
      return "";
    }
    const container = document.createElement("div");
    container.innerHTML = source;
    const styleContent = Array.from(container.querySelectorAll("style"))
      .map((node) => String(node.textContent || ""))
      .join("\n")
      .trim();
    const firstItem = container.querySelector('.yomitan-glossary li[data-dictionary], li[data-dictionary]');
    if (!firstItem) {
      return "";
    }
    const dictionaryTitle = String(firstItem.getAttribute("data-dictionary") || "").trim();
    const contentNode = firstItem.querySelector(":scope > span");
    const contentHtml = (contentNode ? contentNode.innerHTML : firstItem.innerHTML).trim();
    if (!contentHtml) {
      return "";
    }
    const normalizedContent = brief ? compactGlossaryHtml(contentHtml) : contentHtml;
    const dictionaryLabel =
      !hideDictionaryTitle && dictionaryTitle ? `<i>(${escapeHtml(dictionaryTitle)})</i> ` : "";
    const css = styleContent || getGlossaryInlineCss(options);
    return `<div style="text-align: left;" class="yomitan-glossary">${dictionaryLabel}${normalizedContent}<style>${css}</style></div>`;
  }

  function glossaryToPlainHtml(glossary, dictionaryTitle = "", options = {}) {
    const { firstOnly = false, noDictionaryTag = false } = options;
    const target = firstOnly ? extractFirstGlossaryItem(glossary) : glossary;
    const lines = glossaryToList(target);
    if (!lines.length) {
      return "";
    }
    const dictionaryLabel =
      !noDictionaryTag && String(dictionaryTitle || "").trim()
        ? `(${escapeHtml(dictionaryTitle)})<br>`
        : "";
    return `${dictionaryLabel}${lines.map((line) => escapeHtml(line)).join("<br>")}`;
  }

  function pickFrequencyHarmonicRank(data) {
    if (data == null) return "";
    if (typeof data === "object") {
      const keys = ["frequencyHarmonicRank", "harmonicRank", "harmonic_rank", "harmonic", "rank"];
      for (const key of keys) {
        const value = data[key];
        if (typeof value === "number" || typeof value === "string") {
          return String(value);
        }
      }
    }
    return "";
  }

  function parseMetaDataInput(data) {
    if (typeof data !== "string") return data;
    const text = data.trim();
    if (!text) return data;
    if (!(text.startsWith("{") || text.startsWith("["))) return data;
    try {
      return JSON.parse(text);
    } catch (error) {
      return data;
    }
  }

  function cloneCurrentClipSnapshot() {
    return {
      audioClipDataUrl: state.audioClipDataUrl || "",
      audioClipFilename: state.audioClipFilename || "",
      audioClipMime: state.audioClipMime || "",
      screenshotDataUrl: "",
      screenshotFilename: "",
      screenshotMime: ""
    };
  }

  function pushUniqueItem(items, value) {
    const text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
    if (!text || text === "[object Object]") return;
    if (!items.includes(text)) {
      items.push(text);
    }
  }

  function htmlTextLines(value) {
    const source = String(value == null ? "" : value).trim();
    if (!source) return [];
    if (/<[a-z][\s\S]*>/i.test(source) && typeof document !== "undefined") {
      const container = document.createElement("div");
      container.innerHTML = source;
      const lineNodes = Array.from(container.querySelectorAll("li, tr, p, div"));
      const lineTexts = lineNodes
        .map((node) => String(node.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (lineTexts.length) {
        return lineTexts;
      }
      const text = String(container.textContent || "").replace(/\s+/g, " ").trim();
      return text ? [text] : [];
    }
    return source
      .replace(/<br\s*\/?>/gi, "\n")
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  function parseDictionaryValueLine(line, fallbackDictionary) {
    const cleaned = String(line || "")
      .replace(/^[\s:：,，/|・\-–—•*]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) {
      return null;
    }
    const colonIndex = cleaned.search(/[：:]/);
    if (colonIndex > 0 && colonIndex <= 48) {
      const dictionary = cleaned.slice(0, colonIndex).trim();
      const value = cleaned.slice(colonIndex + 1).trim();
      if (dictionary && value) {
        return { dictionary, value };
      }
    }
    return {
      dictionary: String(fallbackDictionary || "").trim(),
      value: cleaned
    };
  }

  function collectDictionaryValues(items) {
    const map = new Map();
    const add = (dictionary, value) => {
      const dict = String(dictionary || "").trim();
      const text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
      if (!dict || !text || text === "[object Object]") return;
      const values = map.get(dict) || [];
      pushUniqueItem(values, text);
      map.set(dict, values);
    };
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (!item) return;
      if (Array.isArray(item.values)) {
        item.values.forEach((value) => add(item.dictionary, value));
      } else {
        add(item.dictionary, item.value);
      }
    });
    return Array.from(map.entries()).map(([dictionary, values]) => ({ dictionary, values }));
  }

  function extractDictionaryDisplayItems(data, fallbackDictionary) {
    const source = parseMetaDataInput(data);
    const fallback = String(fallbackDictionary || "Frequency").trim();
    const items = [];
    const visited = new Set();
    const addLine = (line, dictionary = fallback) => {
      const parsed = parseDictionaryValueLine(line, dictionary);
      if (parsed && parsed.dictionary && parsed.value) {
        items.push(parsed);
      }
    };
    const visit = (node, dictionary = fallback) => {
      if (node == null) return;
      if (typeof node === "number" || typeof node === "string") {
        htmlTextLines(node).forEach((line) => addLine(line, dictionary));
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((item) => visit(item, dictionary));
        return;
      }
      if (typeof node === "object") {
        if (visited.has(node)) return;
        visited.add(node);
        const nextDictionary = String(
          node.dictionary ||
            node.dictionaryTitle ||
            node.dictionaryAlias ||
            node.title ||
            node.name ||
            dictionary ||
            fallback
        ).trim();
        if (Object.prototype.hasOwnProperty.call(node, "displayValue")) {
          visit(node.displayValue, nextDictionary);
        }
        if (Object.prototype.hasOwnProperty.call(node, "value")) {
          visit(node.value, nextDictionary);
        }
        if (Object.prototype.hasOwnProperty.call(node, "frequency")) {
          visit(node.frequency, nextDictionary);
        }
      }
    };

    visit(source, fallback);
    return collectDictionaryValues(items);
  }

  function extractFrequencyItems(row) {
    const fallback = String(row && row.dictionaryTitle ? row.dictionaryTitle : "").trim();
    return extractDictionaryDisplayItems(row ? row.data : "", fallback && fallback !== "meta" ? fallback : "Frequency")
      .filter((item) => item.dictionary && item.values.length);
  }

  function extractPitchItems(row) {
    const fallback = String(row && row.dictionaryTitle ? row.dictionaryTitle : "").trim() || "アクセント辞典";
    const source = parseMetaDataInput(row ? row.data : "");
    const items = [];
    const add = (dictionary, value) => {
      const parsed = parseDictionaryValueLine(value, dictionary || fallback);
      if (parsed && parsed.dictionary && parsed.value) {
        items.push(parsed);
      }
    };

    if (source && typeof source === "object" && !Array.isArray(source) && Array.isArray(source.pitches)) {
      const positions = extractPitchPositions(source).map((position) => `[${position}]`);
      const reading = String(source.reading || source.term || source.expression || "").trim();
      if (positions.length) {
        add(fallback, `${reading ? `${reading} ` : ""}${positions.join(" ")}`.trim());
      }
    } else {
      extractDictionaryDisplayItems(source, fallback).forEach((item) => {
        item.values
          .filter((value) => /\[[0-9,\s]+\]/.test(String(value || "")))
          .forEach((value) => add(item.dictionary, value));
      });
      if (!items.length) {
        const positions = extractPitchPositions(source).map((position) => `[${position}]`);
        if (positions.length) {
          add(fallback, positions.join(" "));
        }
      }
    }

    return collectDictionaryValues(items);
  }

  function splitPronunciationMoras(reading) {
    const smallKana = new Set("ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ");
    const moras = [];
    String(reading || "")
      .trim()
      .split("")
      .forEach((character) => {
        if (smallKana.has(character) && moras.length) {
          moras[moras.length - 1] += character;
        } else {
          moras.push(character);
        }
      });
    return moras.filter(Boolean);
  }

  function getMoraPitch(position, moraIndex) {
    const downstep = Number(position);
    if (!Number.isFinite(downstep)) return "low";
    if (downstep === 0) return moraIndex === 0 ? "low" : "high";
    if (downstep === 1) return moraIndex === 0 ? "high" : "low";
    return moraIndex > 0 && moraIndex < downstep ? "high" : "low";
  }

  function parsePitchDisplayValue(value, fallbackReading = "", dictionary = "") {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return null;
    const dictionaryText = String(dictionary || "").trim();
    const valueText =
      dictionaryText && text.startsWith(`${dictionaryText} `)
        ? text.slice(dictionaryText.length).trim()
        : text;
    const match = valueText.match(/^(.*?)\s*\[([0-9,\s]+)\]\s*$/);
    if (!match) return null;
    const reading = match[1].trim() || String(fallbackReading || "").trim();
    const positions = match[2]
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item));
    if (!reading || !positions.length) return null;
    return { reading, positions };
  }

  function createPitchPronunciation(reading, position) {
    const moras = splitPronunciationMoras(reading);
    if (!moras.length) return null;
    const container = document.createElement("span");
    container.className = "ankiouo-pronunciation-text";
    moras.forEach((mora, index) => {
      const currentPitch = getMoraPitch(position, index);
      const nextPitch = index + 1 < moras.length ? getMoraPitch(position, index + 1) : "low";
      const moraNode = document.createElement("span");
      moraNode.className = "ankiouo-pronunciation-mora";
      moraNode.dataset.pitch = currentPitch;
      moraNode.dataset.pitchNext = nextPitch;
      const charNode = document.createElement("span");
      charNode.className = "ankiouo-pronunciation-character";
      charNode.textContent = mora;
      const lineNode = document.createElement("span");
      lineNode.className = "ankiouo-pronunciation-mora-line";
      moraNode.appendChild(charNode);
      moraNode.appendChild(lineNode);
      container.appendChild(moraNode);
    });
    return container;
  }

  function mergeDictionaryItems(target, items) {
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (!item || !item.dictionary) return;
      const values = target.get(item.dictionary) || [];
      (Array.isArray(item.values) ? item.values : []).forEach((value) => pushUniqueItem(values, value));
      if (values.length) {
        target.set(item.dictionary, values);
      }
    });
  }

  function extractFrequencyNumbers(data) {
    const source = parseMetaDataInput(data);
    const values = [];
    const seen = new Set();
    const visitedObjects = new Set();
    const knownKeys = [
      "frequency",
      "freq",
      "value",
      "rank",
      "position",
      "score",
      "occurrence",
      "count",
      "zipf"
    ];
    const pushValue = (input) => {
      const number = Number(input);
      if (!Number.isFinite(number) || number <= 0) return;
      const normalized = Number(number.toFixed(6));
      if (seen.has(normalized)) return;
      seen.add(normalized);
      values.push(normalized);
    };
    const visit = (node) => {
      if (node == null) return;
      const nodeType = typeof node;
      if (nodeType === "number") {
        pushValue(node);
        return;
      }
      if (nodeType === "string") {
        const matches = node.match(/-?\d+(?:\.\d+)?/g);
        if (matches) {
          matches.forEach((part) => pushValue(part));
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (nodeType === "object") {
        if (visitedObjects.has(node)) return;
        visitedObjects.add(node);
        knownKeys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(node, key)) {
            visit(node[key]);
          }
        });
        Object.values(node).forEach(visit);
      }
    };
    visit(source);
    return values;
  }

  function computeFrequencyHarmonicRank(values) {
    const numericValues = (Array.isArray(values) ? values : [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (!numericValues.length) return "";
    const reciprocalSum = numericValues.reduce((sum, value) => sum + 1 / value, 0);
    if (!Number.isFinite(reciprocalSum) || reciprocalSum <= 0) return "";
    const harmonicMean = numericValues.length / reciprocalSum;
    if (!Number.isFinite(harmonicMean) || harmonicMean <= 0) return "";
    const rounded = Math.round(harmonicMean);
    if (Math.abs(harmonicMean - rounded) < 1e-6) {
      return String(rounded);
    }
    return harmonicMean.toFixed(2).replace(/\.?0+$/, "");
  }

  function extractPitchPositions(data) {
    const source = parseMetaDataInput(data);
    const positions = [];
    const seen = new Set();
    const push = (value) => {
      const number = Number(value);
      if (!Number.isFinite(number)) return;
      const normalized = String(Math.trunc(number));
      if (seen.has(normalized)) return;
      seen.add(normalized);
      positions.push(normalized);
    };

    if (source && typeof source === "object" && Array.isArray(source.pitches)) {
      source.pitches.forEach((item) => {
        if (item && typeof item === "object") {
          if (Array.isArray(item.positions)) item.positions.forEach((value) => push(value));
          if (Object.prototype.hasOwnProperty.call(item, "position")) push(item.position);
          if (Object.prototype.hasOwnProperty.call(item, "pos")) push(item.pos);
        } else {
          push(item);
        }
      });
    }
    return positions;
  }

  function extractFrequencyDisplayValues(data) {
    return extractDictionaryDisplayItems(data, "Frequency").flatMap((item) => item.values);
  }

  function buildAnkiPayload(entry, options = {}) {
    const activeCue = state.activeCue;
    const cueRange = getCurrentCueExportRange();
    const cueWindow = cueRange
      ? getCueMediaWindowFromIndices(cueRange.startIndex, cueRange.endIndex)
      : getCueMediaWindow(activeCue);
    const sentence =
      options.sentence != null
        ? String(options.sentence)
        : cueRange
          ? cueRange.sentence
          : activeCue
            ? activeCue.text
            : "";
    const expression = entry.expression || queryInput.value.trim();
    const reading = entry.reading || "";
    const lookupToken = options.lookupToken != null ? String(options.lookupToken) : state.currentLookupToken || expression;
    const lookupSurface =
      options.lookupSurface != null ? String(options.lookupSurface) : state.currentLookupSurface || "";
    const entryClozeContext = resolveEntryClozeContext(
      sentence,
      entry,
      options.clozeContext != null ? options.clozeContext : state.currentLookupClozeContext
    );
    const cloze = getClozeParts(
      sentence,
      lookupSurface || lookupToken,
      [lookupToken, expression],
      entryClozeContext || (options.clozeContext != null ? options.clozeContext : state.currentLookupClozeContext)
    );
    const values = {
      "cloze-prefix": cloze.prefix,
      "cloze-body": cloze.body,
      "cloze-suffix": cloze.suffix,
      "cloze-body-kana": cloze.bodyKana || "",
      expression,
      reading,
      sentence,
      "clip-start":
        options.start != null
          ? String(options.start)
          : cueRange || activeCue
            ? Number(cueWindow.start || 0).toFixed(2)
            : "",
      "clip-end":
        options.end != null
          ? String(options.end)
          : cueRange || activeCue
            ? Number(cueWindow.end || 0).toFixed(2)
            : "",
      start:
        options.start != null
          ? String(options.start)
          : cueRange || activeCue
            ? Number(cueWindow.start || 0).toFixed(2)
            : "",
      end:
        options.end != null
          ? String(options.end)
          : cueRange || activeCue
            ? Number(cueWindow.end || 0).toFixed(2)
            : "",
      "audio-file": state.audioClipFilename || "",
      "screenshot-file": state.screenshotFilename || ""
    };
    const sentenceHtml = values["cloze-body"]
      ? `${values["cloze-prefix"]}<b>${values["cloze-body"]}</b>${values["cloze-suffix"]}`
      : sentence;
    values["sentence-html"] = sentenceHtml;
    values["cloze-sentence"] = sentenceHtml;
    state.ankiPayload = {
      values,
      rendered: renderAnkiTemplate(ankiTemplate.value, values),
      lapisFields: {
        fldExpression: expression,
        fldExpressionFurigana: "",
        fldExpressionReading: reading,
        fldMainDefinition: "",
        fldSentence: sentenceHtml,
        fldGlossary: "",
        fldPitchPosition: "",
        fldFrequency: "",
        fldFreqSort: "",
        fldIsClickCard: "x"
      }
    };
    setStatus(t("statusAnkiPayloadReady", { expression }));
    setLookupStatus(t("statusAnkiPayloadReady", { expression }));
    if (options.updatePreview) {
      updateAnkiPreviewFromPayload();
    }
    if (options.showPopup !== false) {
      lookupPopup.classList.remove("ankiouo-hidden");
    }
  }

  function stripDataUrlPrefix(value) {
    const source = String(value || "");
    const commaIndex = source.indexOf(",");
    return commaIndex === -1 ? source : source.slice(commaIndex + 1);
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

  function sanitizeFilename(value, fallback) {
    const cleaned = String(value || "")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned || fallback;
  }

  function ensureAnkiPayloadForExport() {
    if (state.ankiPayload && (state.ankiPayload.values || state.ankiPayload.markers)) {
      return state.ankiPayload;
    }

    if (!state.lastLookupEntry && !state.currentResults.length && !state.currentLookupToken && !queryInput.value.trim() && !state.activeCue) {
      buildAnkiPayload(
        {
          expression: "食べる",
          reading: "たべる",
          glossary: ["to eat", "consume food"]
        },
        {
          sentence: "パンを食べる。",
          lookupToken: "食べる",
          start: "0.00",
          end: "1.23"
        }
      );
      return state.ankiPayload;
    }

    const fallbackExpression =
      (state.lastLookupEntry && state.lastLookupEntry.expression) ||
      state.currentLookupToken ||
      queryInput.value.trim() ||
      (state.activeCue ? state.activeCue.text.trim() : "") ||
      "Test";

    const fallbackEntry =
      state.lastLookupEntry ||
      state.currentResults[0] ||
      (fallbackExpression
        ? {
            expression: fallbackExpression,
            reading: "",
            glossary: []
          }
        : null);

    if (!fallbackEntry) {
      throw new Error(t("errorAnkiPayloadMissing"));
    }

    buildAnkiPayload(fallbackEntry);
    return state.ankiPayload;
  }

  function createDesktopExportSnapshot() {
    const ankiPayload = ensureAnkiPayloadForExport();
    const values = ankiPayload.values || ankiPayload.markers || {};
    const activeCue = state.activeCue;
    const cueRange = getCurrentCueExportRange();
    const cueWindow = cueRange
      ? getCueMediaWindowFromIndices(cueRange.startIndex, cueRange.endIndex)
      : getCueMediaWindow(activeCue);
    return {
      values: { ...values },
      rendered: ankiPayload.rendered || "",
      sentenceHtml: values["sentence-html"] || (ankiPayload.lapisFields ? ankiPayload.lapisFields.fldSentence || "" : ""),
      expression: values.expression || "",
      reading: values.reading || "",
      sentence: values.sentence || "",
      clipStart:
        cueRange || (activeCue && activeCue.start != null) ? Number(cueWindow.start || 0).toFixed(2) : values.start || "",
      clipEnd:
        cueRange || (activeCue && activeCue.end != null) ? Number(cueWindow.end || 0).toFixed(2) : values.end || ""
    };
  }

  function buildDesktopAnkiPayload(mediaSnapshot = {}, exportSnapshot = null) {
    const snapshot = exportSnapshot || createDesktopExportSnapshot();
    const payload = {
      audioField: DEFAULT_AUDIO_FIELD,
      pictureField: DEFAULT_PICTURE_FIELD,
      rendered: snapshot.rendered || "",
      expression: snapshot.expression || "",
      reading: snapshot.reading || "",
      sentence: snapshot.sentence || "",
      "sentence-html": snapshot.sentenceHtml || "",
      "clip-start": snapshot.clipStart || "",
      "clip-end": snapshot.clipEnd || "",
      "source-page-url": location.href,
      "source-audio-url": mediaSnapshot.sourceAudioUrl || "",
      "source-audio-backup-url": mediaSnapshot.sourceAudioBackupUrl || "",
      "source-audio-codecs": mediaSnapshot.sourceAudioCodecs || "",
      "client-build": "20260326-player-v1",
      "audio-file": mediaSnapshot.audioClipFilename ? sanitizeFilename(mediaSnapshot.audioClipFilename, "audio.m4a") : "",
      "audio-mime": mediaSnapshot.audioClipMime || "",
      "screenshot-file": mediaSnapshot.screenshotFilename ? sanitizeFilename(mediaSnapshot.screenshotFilename, "screenshot.jpg") : "",
      "screenshot-mime": mediaSnapshot.screenshotMime || ""
    };
    ["cloze-prefix", "cloze-body", "cloze-body-kana", "cloze-suffix", "cloze-sentence", "start", "end", "clip-start", "clip-end"].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(snapshot.values || {}, key)) {
        payload[key] = snapshot.values[key] == null ? "" : String(snapshot.values[key]);
      }
    });
    return payload;
  }

  function hasRuntimeMessaging() {
    return !!(EXTENSION_API && EXTENSION_API.runtime && typeof EXTENSION_API.runtime.sendMessage === "function");
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

  async function fetchDesktopJson(url, options = {}) {
    try {
      const response = await fetchWithTimeout(url, options, options.timeoutMs || DESKTOP_REQUEST_TIMEOUT_MS);
      const payload = await response.json().catch(() => null);
      return {
        ok: response.ok,
        status: response.status,
        payload
      };
    } catch (directError) {
      if (!hasRuntimeMessaging()) {
        throw directError;
      }

      try {
        const response = await sendRuntimeMessage({
          type: "fetchDesktopBridgeJson",
          url,
          method: options.method || "GET",
          headers: options.headers || {},
          body: options.body || "",
          timeoutMs: options.timeoutMs || DESKTOP_REQUEST_TIMEOUT_MS
        });
        return {
          ok: true,
          status: response.status || 200,
          payload: response.data || {}
        };
      } catch (backgroundError) {
        const directMessage = directError && directError.message ? directError.message : String(directError);
        const backgroundMessage = backgroundError && backgroundError.message ? backgroundError.message : String(backgroundError);
        throw new Error(`direct fetch failed: ${directMessage}; background fetch failed: ${backgroundMessage}`);
      }
    }
  }

  async function fetchDesktopImportError(serverUrl) {
    try {
      const requestUrl = new URL(serverUrl);
      requestUrl.pathname = "/last-import-error";
      requestUrl.search = "";
      requestUrl.hash = "";
      const response = await fetchDesktopJson(requestUrl.toString(), { method: "GET", timeoutMs: 4000 });
      const payload = response && response.payload ? response.payload : {};
      return String((payload && payload.error) || "").trim();
    } catch (error) {
      return "";
    }
  }

  async function sendRuntimeMessage(message) {
    if (!hasRuntimeMessaging()) {
      throw new Error("runtime messaging unavailable");
    }
    if (typeof browser !== "undefined" && browser.runtime && typeof browser.runtime.sendMessage === "function") {
      const response = await browser.runtime.sendMessage(message);
      if (!response) {
        throw new Error("empty runtime response");
      }
      if (response.ok === false) {
        throw new Error(response.error || "runtime request failed");
      }
      return response;
    }
    return new Promise((resolve, reject) => {
      EXTENSION_API.runtime.sendMessage(message, (response) => {
        const runtimeError = EXTENSION_API.runtime && EXTENSION_API.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message || String(runtimeError)));
          return;
        }
        if (!response) {
          reject(new Error("empty runtime response"));
          return;
        }
        if (response.ok === false) {
          reject(new Error(response.error || "runtime request failed"));
          return;
        }
        resolve(response);
      });
    });
  }

  function buildDesktopAnkiFormData(payload, options = {}) {
    const includeBinaryFromState = options.includeBinaryFromState !== false;
    const mediaSnapshot = options.mediaSnapshot || {};
    const formData = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      formData.append(key, String(value == null ? "" : value));
    });

    if (includeBinaryFromState && mediaSnapshot.screenshotDataUrl) {
      const imageName = payload["screenshot-file"] || mediaSnapshot.screenshotFilename || "screenshot.jpg";
      const imageBlob = dataUrlToBlob(mediaSnapshot.screenshotDataUrl, mediaSnapshot.screenshotMime || "image/jpeg");
      formData.append("screenshot-binary", imageBlob, imageName);
    }
    return formData;
  }

  function updateAnkiPreviewFromPayload() {
    try {
      const payload = buildDesktopAnkiPayload();
      const serialized = JSON.stringify(payload, null, 2);
      ankiPreview.value = serialized;
    } catch (error) {
      const fallback = state.ankiPayload && state.ankiPayload.rendered ? state.ankiPayload.rendered : "";
      ankiPreview.value = fallback;
    }
  }

  async function prepareDesktopAnkiMedia() {
    const mediaSnapshot = cloneCurrentClipSnapshot();
    const trackedVideo = getTrackedVideo();
    if (trackedVideo) {
      const liveCue = findActiveCue(Number(trackedVideo.currentTime || 0));
      state.activeCue = liveCue || null;
    }
    if (/bilibili\.com$/i.test(String(location.hostname || ""))) {
      try {
        const resolved = await resolveBilibiliAudioInfo();
        rememberSourceAudioInfo(resolved.audio);
        Object.assign(mediaSnapshot, buildSourceAudioSnapshot(resolved.audio));
      } catch (error) {}
    }
    setStatus(t("statusPreparingDesktopAudio"));
    setStatus(t("statusPreparingScreenshot"));
    try {
      Object.assign(mediaSnapshot, await captureCurrentSubtitleScreenshot({ updateState: false }));
    } catch (error) {}
    return mediaSnapshot;
  }

  async function addAnkiForEntry(entry, options = {}) {
    if (!entry) {
      throw new Error(t("errorNoExportableEntry"));
    }
    if (options.closeRangeImmediately) {
      closeRangePopup();
    }
    if (state.closeLookupAfterAdd) {
      closeLookupPopup();
    } else {
      resumeVideoAfterLookupPause();
    }
    setLookupStatus(t("statusBuildingCard", { expression: entry.expression || "" }));
    setStatus(t("statusBuildingCard", { expression: entry.expression || "" }));
    buildAnkiPayload(entry, { updatePreview: false, showPopup: !state.closeLookupAfterAdd });
    setLookupStatus(t("statusPreparingScreenshot"));
    setStatus(t("statusPreparingScreenshot"));
    await sendToDesktopAnki();
    setLookupStatus(t("statusDesktopSent"));
    setStatus(t("statusDesktopSent"));
    if (!options.closeRangeImmediately) {
      closeRangePopup();
    }
  }

  function renderEntries(entries, query, target = results) {
    state.currentResults = entries;
    if (entries.length) {
      state.lastLookupEntry = entries[0];
    }
    clearElement(target);

    if (!entries.length) {
      showResultsEmpty(t("statusLookupNone", { term: query }), target);
      return;
    }

    entries.forEach((entry) => {
      const card = document.createElement("article");
      card.className = "ankiouo-entry";

      const topBar = document.createElement("div");
      topBar.className = "ankiouo-entry-top";

      const head = document.createElement("div");
      head.className = "ankiouo-entry-head";

      const headword = document.createElement("div");
      headword.className = "ankiouo-entry-headword headword";
      const normalizedExpression = String(entry.expression || "").trim();
      const normalizedReading = String(entry.reading || "").trim();
      const furiganaSegments = distributeFurigana(normalizedExpression, normalizedReading);
      const hasRuby = hasRubySegments(furiganaSegments);
      const readingIsSame = isReadingEquivalent(normalizedExpression, normalizedReading);
      headword.dataset.readingIsSame = readingIsSame ? "true" : "false";
      headword.dataset.hasRuby = hasRuby ? "true" : "false";

      const textContainer = document.createElement("div");
      textContainer.className = "headword-text-container";

      const termOuter = document.createElement("span");
      termOuter.className = "headword-term-outer";
      const expression = document.createElement("span");
      expression.className = "ankiouo-expression headword-term";
      expression.appendChild(createFuriganaNode(normalizedExpression || "(no expression)", normalizedReading));
      termOuter.appendChild(expression);
      textContainer.appendChild(termOuter);

      if (normalizedReading && !readingIsSame && !hasRuby) {
        const readingOuter = document.createElement("span");
        readingOuter.className = "headword-reading-outer";
        const reading = document.createElement("span");
        reading.className = "ankiouo-reading headword-reading";
        reading.textContent = normalizedReading;
        readingOuter.appendChild(reading);
        textContainer.appendChild(readingOuter);
      }

      headword.appendChild(textContainer);
      head.appendChild(headword);

      if (entry.termTags) {
        const tags = document.createElement("div");
        tags.className = "ankiouo-tags";
        tags.textContent = String(entry.termTags);
        head.appendChild(tags);
      }

      const addAnkiButton = document.createElement("button");
      addAnkiButton.type = "button";
      addAnkiButton.className = "ankiouo-secondary ankiouo-mini";
      addAnkiButton.textContent = "+";
      addAnkiButton.title = "Add Anki";
      addAnkiButton.setAttribute("aria-label", "Add Anki");
      addAnkiButton.addEventListener("click", async () => {
        try {
          await addAnkiForEntry(entry);
        } catch (error) {
          setLookupStatus(t("statusAutoSendFailed", { error: error.message }));
          setStatus(t("statusAutoSendFailed", { error: error.message }));
        }
      });

      const rangeButton = document.createElement("button");
      rangeButton.type = "button";
      rangeButton.className = "ankiouo-secondary ankiouo-mini";
      rangeButton.textContent = "...";
      rangeButton.addEventListener("click", () => {
        state.rangePanelEntry = entry;
        openRangePopup();
      });

      const actionGroup = document.createElement("div");
      actionGroup.className = "ankiouo-entry-actions";
      actionGroup.appendChild(addAnkiButton);
      actionGroup.appendChild(rangeButton);

      topBar.appendChild(head);
      topBar.appendChild(actionGroup);
      card.appendChild(topBar);
      const metaBlock = renderTermMetaBlock(entry.termMetaRows || [], entry.reading || entry.expression || "");
      if (metaBlock) {
        card.appendChild(metaBlock);
      }
      const sourceEntries = Array.isArray(entry.sourceEntries) && entry.sourceEntries.length ? entry.sourceEntries : [entry];
      sourceEntries.forEach((sourceEntry) => {
        card.appendChild(renderGlossary(sourceEntry.glossary, sourceEntry.dictionaryTitle || ""));
      });
      target.appendChild(card);
    });
  }

  function groupEntriesBySurface(entries) {
    const normalizeSurfaceKey = (value) =>
      String(value || "")
        .normalize("NFKC")
        .replace(/\s+/g, "")
        .trim();
    const groups = new Map();
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const expressionKey = normalizeSurfaceKey(entry.expression || "");
      const readingKey = normalizeSurfaceKey(entry.reading || "");
      const key = expressionKey || readingKey || `${String(entry.id || "")}`;
      if (!groups.has(key)) {
        groups.set(key, {
          expression: entry.expression || "",
          reading: entry.reading || "",
          termTags: entry.termTags || "",
          dictionaryTitle: entry.dictionaryTitle || "",
          glossary: entry.glossary || [],
          raw: entry.raw,
          sourceEntries: [],
          termMetaRows: []
        });
      }
      const group = groups.get(key);
      if (Array.isArray(entry.termMetaRows) && entry.termMetaRows.length) {
        group.termMetaRows.push(...entry.termMetaRows);
      }
      if (Array.isArray(entry.sourceEntries) && entry.sourceEntries.length) {
        entry.sourceEntries.forEach((sourceEntry) => group.sourceEntries.push(sourceEntry));
      } else {
        group.sourceEntries.push(entry);
      }
      if (!group.dictionaryTitle && entry.dictionaryTitle) {
        group.dictionaryTitle = entry.dictionaryTitle;
      }
    });
    return Array.from(groups.values());
  }

  function createMetaDictionaryLabel(dictionary, className = "") {
    const label = document.createElement("span");
    label.className = `ankiouo-meta-dictionary ${className}`.trim();
    label.textContent = dictionary;
    return label;
  }

  function renderFrequencyValues(parent, values) {
    if (!parent) return;
    const list = document.createElement("span");
    list.className = "frequency-value-list";
    (Array.isArray(values) ? values : []).forEach((value, index) => {
      if (index > 0) {
        const separator = document.createElement("span");
        separator.className = "frequency-value";
        separator.textContent = ", ";
        list.appendChild(separator);
      }
      const item = document.createElement("span");
      item.className = "frequency-value";
      item.textContent = String(value);
      list.appendChild(item);
    });
    parent.appendChild(list);
  }

  function renderPitchValueGroup(parent, value, dictionary = "", fallbackReading = "") {
    const parsed = parsePitchDisplayValue(value, fallbackReading, dictionary);
    if (!parsed) return;
    parsed.positions.forEach((position) => {
      const item = document.createElement("div");
      item.className = "ankiouo-pitch-line pronunciation";
      item.dataset.pronunciationType = "pitch-accent";

      const textContainer = document.createElement("span");
      textContainer.className = "ankiouo-pitch-line-text pronunciation-text-container";
      const pronunciation = createPitchPronunciation(parsed.reading, position);
      if (pronunciation) {
        pronunciation.classList.add("pronunciation-text");
        textContainer.appendChild(pronunciation);
      } else {
        textContainer.textContent = parsed.reading;
      }

      const notationContainer = document.createElement("span");
      notationContainer.className = "ankiouo-pitch-line-notation pronunciation-downstep-notation-container";
      const notation = document.createElement("span");
      notation.className = "pronunciation-downstep-notation";
      notation.textContent = `[${position}]`;
      notationContainer.appendChild(notation);

      item.appendChild(textContainer);
      item.appendChild(notationContainer);
      parent.appendChild(item);
    });
  }

  function renderTermMetaBlock(metaRows, fallbackReading = "") {
    const rows = Array.isArray(metaRows) ? metaRows : [];
    if (!rows.length) {
      return null;
    }

    const box = document.createElement("div");
    box.className = "ankiouo-meta ankiouo-yomitan-meta";
    const frequencyItems = new Map();
    const pitchItems = new Map();

    rows.forEach((row) => {
      const mode = String(row.mode || "meta").toLowerCase();
      if (mode === "freq-rank") {
        return;
      }
      if (mode.includes("freq")) {
        mergeDictionaryItems(frequencyItems, extractFrequencyItems(row));
        return;
      }
      if (mode.includes("pitch")) {
        mergeDictionaryItems(pitchItems, extractPitchItems(row));
        return;
      }
    });

    frequencyItems.forEach((values, dictionary) => {
      const row = document.createElement("span");
      row.className = "ankiouo-meta-row ankiouo-meta-row-frequency";
      row.appendChild(createMetaDictionaryLabel(dictionary, "is-frequency"));
      const body = document.createElement("span");
      body.className = "ankiouo-meta-row-body frequency-body";
      renderFrequencyValues(body, values);
      row.appendChild(body);
      box.appendChild(row);
    });
    pitchItems.forEach((values, dictionary) => {
      const row = document.createElement("div");
      row.className = "ankiouo-meta-row ankiouo-meta-row-pitch";
      row.appendChild(createMetaDictionaryLabel(dictionary, "is-pitch"));
      const body = document.createElement("div");
      body.className = "ankiouo-meta-row-body ankiouo-pitch-group-body";
      values.forEach((value) => {
        renderPitchValueGroup(body, value, dictionary, fallbackReading);
      });
      row.appendChild(body);
      box.appendChild(row);
    });

    if (!box.children.length) {
      return null;
    }
    return box;
  }

  async function runLookup(query, options = {}) {
    const normalized = query.trim();
    if (!normalized) {
      return;
    }
    const requestId = options.requestId || beginLookupRequest(normalized, options.target || results);

    queryInput.value = normalized;
    state.currentLookupToken = normalized;
    state.currentLookupSurface = String(options.lookupSurface || normalized).trim();
    state.currentLookupClozeContext = options.clozeContext || null;
    setStatus(normalized);
    setLookupStatus(normalized);
    let enriched = [];
    let remoteError = null;
    try {
      const remote = await fetchDesktopLookup(normalized);
      if (!isActiveLookupRequest(requestId)) return;
      enriched = Array.isArray(remote.entries) ? remote.entries : [];
    } catch (error) {
      if (!isActiveLookupRequest(requestId)) return;
      remoteError = error;
    }

    if (remoteError) {
      const message = t("statusDesktopLookupFailed", { error: remoteError.message });
      setStatus(message);
      setLookupStatus(message);
      showResultsEmpty(t("statusDesktopLookupHint"), options.target || results);
      if (options.popup) {
        lookupPopup.classList.remove("ankiouo-hidden");
      }
      return;
    }

    renderEntries(enriched, normalized, options.target || results);
    if (options.popup) {
      lookupPopup.classList.remove("ankiouo-hidden");
    }
    if (enriched.length) {
      setStatus("");
      setLookupStatus("");
    } else {
      setStatus(t("statusLookupNone", { term: normalized }));
      setLookupStatus(t("statusLookupNone", { term: normalized }));
    }
  }

  function parseSrtTimestamp(value) {
    const match = value.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
    if (!match) {
      return 0;
    }

    const [, hh, mm, ss, ms] = match;
    return Number(hh) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms.padEnd(3, "0").slice(0, 3)) / 1000;
  }

  function stripAssTags(text) {
    return normalizeSubtitleText(
      text
      .replace(/\{[^}]*\}/g, "")
    );
  }

  function normalizeSubtitleText(text) {
    return String(text || "")
      .replace(/\\N/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\h/g, " ")
      .trim();
  }

  function parseSrt(text) {
    return text
      .replace(/\r/g, "")
      .split(/\n\n+/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const lines = block.split("\n");
        const timeLine = lines.find((line) => line.includes("-->")) || "";
        const [startRaw, endRaw] = timeLine.split("-->").map((item) => item.trim());
        const contentLines = lines.slice(lines.indexOf(timeLine) + 1);
        return {
          start: parseSrtTimestamp(startRaw || "0:00:00,000"),
          end: parseSrtTimestamp(endRaw || "0:00:00,000"),
          text: normalizeSubtitleText(contentLines.join("\n"))
        };
      })
      .filter((cue) => cue.text);
  }

  function parseAss(text) {
    const lines = text.replace(/\r/g, "").split("\n");
    let inEvents = false;
    let formatColumns = [];
    const cues = [];

    lines.forEach((line) => {
      if (/^\[Events\]/i.test(line)) {
        inEvents = true;
        return;
      }

      if (!inEvents) {
        return;
      }

      if (/^Format:/i.test(line)) {
        formatColumns = line.replace(/^Format:/i, "").split(",").map((item) => item.trim().toLowerCase());
        return;
      }

      if (!/^Dialogue:/i.test(line)) {
        return;
      }

      const payload = line.replace(/^Dialogue:/i, "").trim();
      const parts = [];
      let current = "";
      let commasNeeded = formatColumns.length - 1;

      for (let index = 0; index < payload.length; index += 1) {
        const character = payload[index];
        if (character === "," && parts.length < commasNeeded) {
          parts.push(current);
          current = "";
        } else {
          current += character;
        }
      }
      parts.push(current);

      const record = Object.fromEntries(formatColumns.map((column, index) => [column, parts[index] || ""]));
      if (!record.start || !record.end || !record.text) {
        return;
      }

      cues.push({
        start: parseSrtTimestamp(record.start.replace(/\./g, ",")),
        end: parseSrtTimestamp(record.end.replace(/\./g, ",")),
        text: stripAssTags(record.text)
      });
    });

    return cues.filter((cue) => cue.text);
  }

  function isLookupableJapanese(token) {
    return /[一-龯々ぁ-ゖァ-ヺー]/.test(token);
  }

  function isJapaneseChar(character) {
    return /[一-龯々ぁ-ゖァ-ヺー]/.test(String(character || ""));
  }

  function getPointRange(clientX, clientY) {
    if (document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(clientX, clientY);
      if (position && position.offsetNode) {
        const range = document.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
        return range;
      }
    }
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(clientX, clientY);
      if (range) {
        return range;
      }
    }
    return null;
  }

  function getSubtitleClickIndex(root, clientX, clientY) {
    if (!root) {
      return -1;
    }
    const pointRange = getPointRange(clientX, clientY);
    if (!pointRange) {
      return -1;
    }
    const pointNode = pointRange.startContainer;
    const pointElement = pointNode && pointNode.nodeType === Node.ELEMENT_NODE ? pointNode : pointNode && pointNode.parentNode;
    if (pointNode !== root && pointElement !== root && !(pointElement && root.contains(pointElement))) {
      return -1;
    }

    const measureRange = document.createRange();
    measureRange.selectNodeContents(root);
    measureRange.setEnd(pointRange.startContainer, pointRange.startOffset);
    const rawIndex = measureRange.toString().length;
    const source = String(root.textContent || "");
    if (!source) {
      return -1;
    }
    if (rawIndex < source.length && isJapaneseChar(source[rawIndex])) {
      return rawIndex;
    }
    if (rawIndex > 0 && isJapaneseChar(source[rawIndex - 1])) {
      return rawIndex - 1;
    }
    if (rawIndex + 1 < source.length && isJapaneseChar(source[rawIndex + 1])) {
      return rawIndex + 1;
    }
    return -1;
  }

  function buildSubtitleContentFragment(source) {
    const fragment = document.createDocumentFragment();
    Array.from(String(source || "")).forEach((character, index) => {
      const span = document.createElement("span");
      span.className = "ankiouo-subtitle-char";
      span.dataset.charIndex = String(index);
      span.textContent = character;
      fragment.appendChild(span);
    });
    return fragment;
  }

  async function resolveLookupByClickPosition(text, absoluteIndex) {
    const source = String(text || "");
    if (absoluteIndex < 0 || absoluteIndex >= source.length) {
      return null;
    }
    if (!isJapaneseChar(source[absoluteIndex])) {
      return null;
    }
    const tokens = await tokeniseSubtitle(source);
    let offset = 0;
    for (const token of tokens) {
      const tokenText = String(token && token.text ? token.text : "");
      const start = offset;
      const end = start + tokenText.length;
      offset = end;
      if (absoluteIndex < start || absoluteIndex >= end) {
        continue;
      }
      if (!token.lookupable) {
        return null;
      }
      const lookupSurface = tokenText;
      const directQuery = String(token.lookupQuery || "").trim();
      if (directQuery) {
        return {
          lookupQuery: directQuery,
          lookupSurface,
          lookupStart: start,
          lookupEnd: end
        };
      }
      const resolved = await resolveLookupQuery(lookupSurface);
      if (!resolved) {
        return null;
      }
      return {
        lookupQuery: resolved,
        lookupSurface,
        lookupStart: start,
        lookupEnd: end
      };
    }
    return null;
  }

  function splitSubtitleChunks(text) {
    return text
      .split(/([一-龯々ぁ-ゖァ-ヺー]+|\n|\s+|[^一-龯々ぁ-ゖァ-ヺー\s\n]+)/g)
      .filter((item) => item !== "");
  }

  function getSegmenterFallbackLength(text) {
    if (!text) {
      return 0;
    }
    if (!state.segmenter) {
      return 1;
    }
    const iterator = state.segmenter.segment(text)[Symbol.iterator]();
    const first = iterator.next();
    if (!first || first.done || !first.value || !first.value.segment) {
      return 1;
    }
    return Math.max(1, String(first.value.segment).length);
  }

  async function resolveLookupQuery(surface) {
    const key = String(surface || "");
    if (!key) {
      return "";
    }
    if (state.surfaceLookupCache.has(key)) {
      return state.surfaceLookupCache.get(key);
    }

    try {
      const remote = await fetchDesktopLookup(key);
      if (remote && remote.resolvedTerm) {
        state.surfaceLookupCache.set(key, remote.resolvedTerm);
        return remote.resolvedTerm;
      }
      if (remote && Array.isArray(remote.entries) && remote.entries.length) {
        const fallbackResolved = String(remote.entries[0].expression || key).trim();
        state.surfaceLookupCache.set(key, fallbackResolved);
        return fallbackResolved;
      }
    } catch (error) {}

    state.surfaceLookupCache.set(key, "");
    return "";
  }

  async function tokeniseJapaneseRun(run) {
    const tokens = [];
    let offset = 0;

    while (offset < run.length) {
      let matched = "";
      let matchedLookup = "";
      const maxLength = Math.min(SUBTITLE_MAX_MATCH_LENGTH, run.length - offset);
      for (let size = maxLength; size >= 1; size -= 1) {
        const candidate = run.slice(offset, offset + size);
        const lookupQuery = await resolveLookupQuery(candidate);
        if (lookupQuery) {
          matched = candidate;
          matchedLookup = lookupQuery;
          break;
        }
      }

      if (matched) {
        tokens.push({ text: matched, lookupable: true, lookupQuery: matchedLookup });
        offset += matched.length;
        continue;
      }

      const fallbackLength = Math.min(getSegmenterFallbackLength(run.slice(offset)), run.length - offset);
      const fallback = run.slice(offset, offset + Math.max(1, fallbackLength));
      tokens.push({ text: fallback, lookupable: isLookupableJapanese(fallback), lookupQuery: "" });
      offset += fallback.length;
    }

    return tokens;
  }

  async function tokeniseSubtitle(text) {
    const chunks = splitSubtitleChunks(text);
    const tokens = [];
    for (const chunk of chunks) {
      if (/^[一-龯々ぁ-ゖァ-ヺー]+$/.test(chunk)) {
        const runTokens = await tokeniseJapaneseRun(chunk);
        tokens.push(...runTokens);
      } else {
        tokens.push({ text: chunk, lookupable: false });
      }
    }
    return tokens;
  }

  async function buildSubtitleLine(cue, options = {}) {
    const { overlay = false } = options;
    const wrapper = document.createElement("div");
    wrapper.className = "ankiouo-subtitle-line";
    if (overlay) {
      wrapper.classList.add("ankiouo-subtitle-line-overlay");
      if (state.subtitleBackgroundEnabled) {
        wrapper.classList.add("ankiouo-subtitle-line-background");
        wrapper.classList.add(
          state.subtitleBackgroundStyle === "glass"
            ? "ankiouo-subtitle-line-background-glass"
            : "ankiouo-subtitle-line-background-plate"
        );
      }
    }

    if (!cue) {
      return wrapper;
    }

    const source = String(cue.text || "");
    clearElement(wrapper);
    wrapper.appendChild(buildSubtitleContentFragment(source));
    wrapper.addEventListener("pointerdown", (event) => {
      if (overlay && state.subtitlePositionMode === "custom") {
        state.subtitleDragPending = true;
        state.subtitleDragPointerId = event.pointerId;
        state.subtitleDragStartX = event.clientX;
        state.subtitleDragStartY = event.clientY;
      }
    });
    wrapper.addEventListener("click", async (event) => {
      const targetElement = event.target && event.target.closest ? event.target.closest("[data-char-index]") : null;
      const clickIndex =
        targetElement && targetElement.dataset
          ? Number(targetElement.dataset.charIndex)
          : getSubtitleClickIndex(wrapper, event.clientX, event.clientY);
      if (clickIndex < 0 || clickIndex >= source.length || !isJapaneseChar(source[clickIndex])) {
        return;
      }

      const clickedChar = source[clickIndex];
      const contextKey = `subtitle:${state.activeCue ? state.activeCue.start : ""}:${clickIndex}:${source}`;
      const requestId = beginLookupRequest(clickedChar, popupResults, contextKey);
      try {
        if (state.pauseOnSubtitleLookup && state.trackedVideo && typeof state.trackedVideo.pause === "function") {
          state.resumeOnPopupClose = !state.trackedVideo.paused;
          state.trackedVideo.pause();
        } else {
          state.resumeOnPopupClose = false;
        }
        queryInput.value = clickedChar;
        setStatus(clickedChar);
        setLookupStatus(clickedChar);
        lookupPopup.classList.remove("ankiouo-hidden");

        let resolved = null;
        let remoteError = null;
        try {
          resolved = await fetchDesktopLookupAt(source, clickIndex);
          if (!isActiveLookupRequest(requestId, contextKey)) return;
        } catch (error) {
          if (!isActiveLookupRequest(requestId, contextKey)) return;
          remoteError = error;
          resolved = await resolveLookupByClickPosition(source, clickIndex);
          if (!isActiveLookupRequest(requestId, contextKey)) return;
        }
        if (!resolved || !resolved.lookupQuery) {
          if (remoteError) {
            reportLookupFailure(
              t("statusDesktopLookupFailed", { error: remoteError && remoteError.message ? remoteError.message : String(remoteError) }),
              popupResults
            );
          } else {
            showResultsEmpty(t("statusNoLookupableWord"), popupResults);
            setLookupStatus(t("statusNoLookupableWord"));
            setStatus(t("statusNoLookupableWord"));
          }
          return;
        }
        const lookupQuery = String(resolved.lookupQuery || "").trim();
        const lookupSurface = String(resolved.lookupSurface || lookupQuery || "").trim();
        const lookupStart = Number(resolved.lookupStart);
        const lookupEnd = Number(resolved.lookupEnd);
        const clozeContext =
          Number.isFinite(lookupStart) && Number.isFinite(lookupEnd) && lookupEnd > lookupStart
            ? createClozeContextFromSpan(source, lookupStart, lookupEnd)
            : null;
        if (!lookupQuery) {
          return;
        }

        if (Array.isArray(resolved.entries) && resolved.entries.length) {
          if (!isActiveLookupRequest(requestId, contextKey)) return;
          queryInput.value = lookupQuery;
          state.currentLookupToken = lookupQuery;
          state.currentLookupSurface = lookupSurface;
          state.currentLookupClozeContext = clozeContext;
          renderEntries(resolved.entries, lookupQuery, popupResults);
          lookupPopup.classList.remove("ankiouo-hidden");
          if (remoteError) {
            const message = t("statusDesktopLookupFallback", { error: remoteError.message });
            setLookupStatus(message);
            setStatus(message);
          } else {
            setLookupStatus("");
            setStatus("");
          }
          return;
        }

        await runLookup(lookupQuery, {
          popup: true,
          target: popupResults,
          lookupSurface,
          clozeContext,
          requestId
        });
      } catch (error) {
        if (!isActiveLookupRequest(requestId, contextKey)) return;
        reportLookupFailure(t("statusClickLookupFailed", { error: error && error.message ? error.message : String(error) }), popupResults);
      }
    });

    return wrapper;
  }

  function positionOverlayToVideo(video) {
    syncRootContainer(video);
    syncVideoOverlayContainer(video);
    if (!video) {
      videoOverlay.classList.add("ankiouo-hidden");
      return;
    }

    const rect = video.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) {
      videoOverlay.classList.add("ankiouo-hidden");
      return;
    }

    videoOverlay.classList.remove("ankiouo-hidden");
    videoOverlay.style.width = `${Math.max(Math.min(rect.width - 24, window.innerWidth - 24), 220)}px`;
    videoOverlay.style.right = "auto";

    if (state.subtitlePositionMode === "custom") {
      const fixedX = rect.left + rect.width / 2;
      const defaultBottom = Math.max(window.innerHeight - rect.bottom + 14, 14);
      const overlayHeight = Math.max(Number(videoOverlay.offsetHeight || 0), 56);
      const defaultY = Math.max(window.innerHeight - defaultBottom - overlayHeight, 14);
      if (state.customSubtitleY == null) {
        state.customSubtitleY = defaultY;
      }
      videoOverlay.style.transform = "translateX(-50%)";
      videoOverlay.style.left = `${fixedX}px`;
      videoOverlay.style.top = `${state.customSubtitleY}px`;
      videoOverlay.style.bottom = "auto";
      videoOverlay.classList.add("ankiouo-draggable");
      return;
    }

    videoOverlay.classList.remove("ankiouo-draggable");
    videoOverlay.style.transform = "translateX(-50%)";
    videoOverlay.style.left = `${rect.left + rect.width / 2}px`;
    if (state.subtitlePositionMode === "top") {
      videoOverlay.style.top = `${Math.max(rect.top + 14, 14)}px`;
      videoOverlay.style.bottom = "auto";
    } else {
      videoOverlay.style.top = "auto";
      videoOverlay.style.bottom = `${Math.max(window.innerHeight - rect.bottom + 14, 14)}px`;
    }
  }

  async function renderSubtitleCue(cue) {
    if (!cue) {
      clearElement(subtitleStage);
      clearElement(videoSubtitleStage);
      return;
    }

    const renderToken = ++state.subtitleRenderToken;
    const panelPromise = buildSubtitleLine(cue, { overlay: false });
    const overlayPromise = state.subtitleOverlayHidden
      ? Promise.resolve(document.createDocumentFragment())
      : buildSubtitleLine(cue, { overlay: true });
    const [panelLine, overlayLine] = await Promise.all([panelPromise, overlayPromise]);
    if (renderToken !== state.subtitleRenderToken) {
      return;
    }

    subtitleStage.replaceChildren(panelLine);
    videoSubtitleStage.replaceChildren(overlayLine);
  }

  function findActiveCue(time) {
    const offset = getSubtitleOffsetSeconds();
    for (let index = state.subtitles.length - 1; index >= 0; index -= 1) {
      const cue = state.subtitles[index];
      if (cue.start + offset <= time && cue.end + offset >= time) {
        return cue;
      }
    }
    return null;
  }

  function getMatchingCueIndicesAtTime(time) {
    const offset = getSubtitleOffsetSeconds();
    const indices = [];
    for (let index = 0; index < state.subtitles.length; index += 1) {
      const cue = state.subtitles[index];
      if (cue.start + offset <= time && cue.end + offset >= time) {
        indices.push(index);
      }
    }
    return indices;
  }

  function clearSwipeJumpChain() {
    state.lastSwipeJumpIndex = -1;
    state.lastSwipeJumpAt = 0;
  }

  function rememberSwipeJumpIndex(index) {
    state.lastSwipeJumpIndex = Number(index);
    state.lastSwipeJumpAt = Date.now();
  }

  function getRecentSwipeJumpIndex() {
    const index = Number(state.lastSwipeJumpIndex);
    if (!Number.isFinite(index) || index < 0) {
      return -1;
    }
    if (!state.lastSwipeJumpAt || Date.now() - state.lastSwipeJumpAt > SWIPE_INDEX_CHAIN_WINDOW_MS) {
      return -1;
    }
    return index;
  }

  function getTrackedVideo() {
    const videos = Array.from(document.querySelectorAll("video"));
    if (!videos.length) {
      state.trackedVideo = null;
      positionOverlayToVideo(null);
      return null;
    }

    const currentTrackedVideo = state.trackedVideo;
    if (currentTrackedVideo && videos.includes(currentTrackedVideo) && isVideoVisible(currentTrackedVideo)) {
      positionOverlayToVideo(currentTrackedVideo);
      return currentTrackedVideo;
    }

    const visibleVideos = videos.filter((video) => isVideoVisible(video));
    const nextVideo =
      visibleVideos.find((video) => !video.paused && !video.ended) ||
      getBestVideoCandidate() ||
      videos[0];
    state.trackedVideo = nextVideo;
    positionOverlayToVideo(nextVideo);
    return nextVideo;
  }

  function updateSubtitleMetaForVideo(video) {
    if (!video) {
      setSubtitleMeta(t("statusSubtitlesImportedNoVideo", { count: state.subtitles.length, offset: formatSubtitleOffsetLabel() }));
      return;
    }

    setSubtitleMeta(
      t("statusSubtitlesFollowing", {
        count: state.subtitles.length,
        offset: formatSubtitleOffsetLabel(),
        time: video.currentTime.toFixed(1)
      })
    );
  }

  function syncRangePopupToActiveCue() {
    if (!rangePopup || rangePopup.classList.contains("ankiouo-hidden")) {
      return;
    }
    if (state.rangePopupAnchorKey) {
      debugRange("syncSkippedLockedAnchor", {
        anchorKey: state.rangePopupAnchorKey
      });
      return;
    }

    const context = getRangePanelWindow();
    if (context) {
      const anchorIndex = context.selection ? context.selection.anchorIndex : getCueIndex(state.activeCue);
      const defaultStart = Math.max(context.windowStart, anchorIndex);
      const defaultEnd = Math.min(context.windowEnd, anchorIndex);
      setCueRangeSelection(defaultStart, defaultEnd, state.activeCue);
    }

    renderRangePopup();
  }

  function handleActiveCueChange(nextCue) {
    state.activeCue = nextCue;
    if (!state.rangePopupAnchorKey) {
      state.cueRangeSelection = null;
    }
    renderSubtitleCue(nextCue).catch((error) => {
      setStatus(t("statusSubtitleImportFailed", { error: error.message }));
    });
    renderSubtitleList();
    syncRangePopupToActiveCue();
  }

  function refreshSubtitleFromVideo(forceRender = false) {
    if (!state.subtitles.length) {
      return;
    }

    const video = getTrackedVideo();
    if (!video) {
      updateSubtitleMetaForVideo(null);
      return;
    }

    const nextCue = findActiveCue(video.currentTime);
    if (forceRender || nextCue !== state.activeCue) {
      handleActiveCueChange(nextCue);
    }

    updateSubtitleMetaForVideo(video);
  }

  function startSubtitleTracking() {
    if (state.videoRefreshHandle) {
      clearInterval(state.videoRefreshHandle);
    }

    state.videoRefreshHandle = window.setInterval(refreshSubtitleFromVideo, SUBTITLE_REFRESH_MS);
  }

  async function handleSearch() {
    const query = queryInput.value.trim();
    if (!query) {
      setStatus(t("statusSelectWordFirst"));
      queryInput.focus();
      return;
    }

    await runLookup(query);
  }

  function parseSubtitleTextToCues(text, name) {
    const lowerName = String(name || "").toLowerCase();
    let cues = [];

    if (lowerName.endsWith(".srt")) {
      cues = parseSrt(text);
    } else if (lowerName.endsWith(".ass") || lowerName.endsWith(".ssa")) {
      cues = parseAss(text);
    } else {
      throw new Error("Unsupported subtitle format.");
    }
    if (!cues.length) {
      throw new Error(t("errorSubtitleParseEmpty"));
    }
    return cues.sort((left, right) => left.start - right.start);
  }

  function updateCurrentSubtitleMeta() {
    const queueSize = Array.isArray(state.subtitleQueue) ? state.subtitleQueue.length : 0;
    const currentItem = state.subtitleQueue[state.subtitleQueueIndex] || null;
    if (!currentItem) {
      setSubtitleMeta(t("noSubtitleImported"));
      return;
    }
    const queueLabel = queueSize > 1 ? ` | ${state.subtitleQueueIndex + 1}/${queueSize}` : "";
    setSubtitleMeta(
      t("statusSubtitleCurrent", {
        name: currentItem.name,
        count: state.subtitles.length,
        offset: formatSubtitleOffsetLabel(),
        queue: queueLabel
      })
    );
  }

  function applySubtitleQueueItem(item, index) {
    if (!item || !Array.isArray(item.cues) || !item.cues.length) {
      return;
    }
    const forceRender = !state.activeCue;
    clearSwipeJumpChain();
    state.subtitleQueueIndex = index;
    state.subtitles = item.cues.slice();
    state.cueRangeSelection = null;
    state.rangePanelEntry = null;
    state.subtitleOverlayHidden = false;
    panel.classList.add("ankiouo-hidden");
    setLauncherSelectionActive(true);
    setQuickSubtitleButtonLabel();
    updateCurrentSubtitleMeta();
    renderSubtitleQueue();
    renderSubtitleList();
    showSubtitleEmpty("");
    startSubtitleTracking();
    refreshSubtitleFromVideo(forceRender);
    setStatus(t("statusSubtitleSwitched", { name: item.name }));
  }

  function activateSubtitleQueueIndex(index) {
    const safeIndex = Math.max(0, Math.min((state.subtitleQueue || []).length - 1, Number(index)));
    const item = state.subtitleQueue[safeIndex];
    if (!item) return;
    applySubtitleQueueItem(item, safeIndex);
  }

  function addSubtitleQueueItems(items, options = {}) {
    const queueItems = (Array.isArray(items) ? items : []).filter((item) => item && Array.isArray(item.cues) && item.cues.length);
    if (!queueItems.length) {
      return;
    }
    const startIndex = state.subtitleQueue.length;
    state.subtitleQueue.push(...queueItems);
    renderSubtitleQueue();
    if (options.activateFirst !== false) {
      activateSubtitleQueueIndex(startIndex);
    } else {
      updateCurrentSubtitleMeta();
    }
    setStatus(t("statusSubtitleQueueAdded", { count: queueItems.length }));
  }

  function removeSubtitleQueueIndex(index) {
    const safeIndex = Number(index);
    if (!Number.isFinite(safeIndex) || safeIndex < 0 || safeIndex >= state.subtitleQueue.length) return;
    state.subtitleQueue.splice(safeIndex, 1);
    if (!state.subtitleQueue.length) {
      clearSubtitle();
      return;
    }
    if (safeIndex < state.subtitleQueueIndex) {
      state.subtitleQueueIndex -= 1;
    } else if (safeIndex === state.subtitleQueueIndex) {
      state.subtitleQueueIndex = Math.max(0, Math.min(state.subtitleQueue.length - 1, safeIndex));
      applySubtitleQueueItem(state.subtitleQueue[state.subtitleQueueIndex], state.subtitleQueueIndex);
      return;
    }
    renderSubtitleQueue();
    updateCurrentSubtitleMeta();
  }

  function stepSubtitleQueue(delta) {
    if (!state.subtitleQueue.length) return;
    const nextIndex = Math.max(0, Math.min(state.subtitleQueue.length - 1, state.subtitleQueueIndex + delta));
    if (nextIndex === state.subtitleQueueIndex) return;
    activateSubtitleQueueIndex(nextIndex);
  }

  async function importSubtitles(files, options = {}) {
    const queueItems = [];
    const failures = [];
    for (const file of Array.from(files || [])) {
      try {
        const text = await readFileAsText(file);
        const cues = parseSubtitleTextToCues(text, file.name);
        queueItems.push(makeSubtitleQueueItem(file.name, cues, options));
      } catch (error) {
        failures.push(`${file && file.name ? file.name : t("unnamed")}: ${error.message}`);
      }
    }
    if (!queueItems.length) {
      throw new Error(failures[0] || t("errorNoImportableSubtitle"));
    }
    addSubtitleQueueItems(queueItems, { activateFirst: true });
    if (failures.length) {
      setStatus(failures[0]);
    }
  }

  function importSubtitleText(text, name, options = {}) {
    const cues = parseSubtitleTextToCues(text, name);
    const item = makeSubtitleQueueItem(name, cues, options);
    addSubtitleQueueItems([item], { activateFirst: true });
    return item;
  }

  async function importSubtitle(file) {
    if (!file) {
      throw new Error(t("errorNoSubtitleFileSelected"));
    }
    await importSubtitles([file], { source: "local" });
  }

  function renderJimakuEntries(entries) {
    if (!jimakuResults) return;
    clearElement(jimakuResults);
    state.jimakuEntries = sortJimakuEntries(entries);
    clearJimakuSelection();
    if (!state.jimakuEntries.length) {
      setEmptyMessage(jimakuResults, t("emptyJimakuEntries"));
      return;
    }
    state.jimakuEntries.slice(0, 20).forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ankiouo-jimaku-item";
      button.textContent = getJimakuEntryLabel(entry);
      button.title = button.textContent;
      button.addEventListener("click", () => {
        if (jimakuResults) {
          [...jimakuResults.querySelectorAll(".ankiouo-jimaku-item")].forEach((item) => item.classList.remove("is-active"));
        }
        button.classList.add("is-active");
        loadJimakuFiles(entry).catch((error) => setJimakuStatus(t("statusJimakuFilesFailed", { error: error.message })));
      });
      jimakuResults.appendChild(button);
    });
  }

  function renderJimakuFiles(files) {
    if (!jimakuFiles) return;
    clearElement(jimakuFiles);
    state.jimakuFiles = normalizeJimakuFiles(files);
    if (jimakuFilesActions) {
      jimakuFilesActions.classList.toggle("ankiouo-hidden", !isJimakuQueueMode());
    }
    pruneJimakuSelectedFiles(state.jimakuFiles);
    setJimakuView("files");
    if (!state.jimakuFiles.length) {
      setEmptyMessage(jimakuFiles, t("emptyJimakuFiles"));
      return;
    }
    const queueMode = isJimakuQueueMode();
    state.jimakuFiles.forEach((file) => {
      const row = queueMode ? renderJimakuQueueFileRow(file) : renderJimakuSingleFileRow(file);
      jimakuFiles.appendChild(row);
    });
  }

  function createJimakuFileLabel(file) {
    const label = document.createElement("div");
    label.className = "ankiouo-jimaku-file-label";
    const size = formatBytes(file.size);
    label.textContent = `${file.name || "(unnamed)"}${size ? ` (${size})` : ""}`;
    label.title = label.textContent;
    return label;
  }

  function createJimakuFileBadge(text) {
    const badge = document.createElement("div");
    badge.className = "ankiouo-jimaku-file-badge";
    badge.textContent = text;
    return badge;
  }

  function renderJimakuQueueFileRow(file) {
    const row = document.createElement("div");
    row.className = "ankiouo-jimaku-file";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "ankiouo-jimaku-file-checkbox";
    const fileKey = getJimakuFileKey(file);
    const supported = isSupportedJimakuSubtitle(file.name);
    checkbox.disabled = !supported;
    checkbox.checked = supported && state.jimakuSelectedFileKeys.has(fileKey);
    checkbox.addEventListener("change", () => {
      setJimakuSelectedFileKey(fileKey, checkbox.checked);
    });
    const label = createJimakuFileLabel(file);
    label.addEventListener("click", () => {
      if (!supported) return;
      checkbox.checked = !checkbox.checked;
      setJimakuSelectedFileKey(fileKey, checkbox.checked);
    });
    row.appendChild(checkbox);
    row.appendChild(label);
    row.appendChild(createJimakuFileBadge(supported ? "srt/ass" : t("unsupported")));
    return row;
  }

  function renderJimakuSingleFileRow(file) {
    const row = document.createElement("div");
    row.className = "ankiouo-jimaku-file is-single";
    const supported = isSupportedJimakuSubtitle(file.name);
    const label = createJimakuFileLabel(file);
    const importFile = (source = "row") => {
      debugJimaku("singleFileClick", {
        source,
        supported,
        fileName: file && file.name ? file.name : "",
        fileUrl: file && file.url ? file.url : "",
        blockedByInFlight: !!state.jimakuImportInFlight
      });
      if (!supported || state.jimakuImportInFlight) return;
      loadJimakuSubtitle(file).catch((error) => setJimakuStatus(t("statusJimakuImportFailed", { error: error.message })));
    };
    row.addEventListener("click", () => importFile("row"));
    label.addEventListener("click", (event) => {
      event.stopPropagation();
      importFile("label");
    });
    row.appendChild(label);
    row.appendChild(createJimakuFileBadge(supported ? t("import") : t("unsupported")));
    return row;
  }

  async function searchJimaku() {
    if (!getJimakuApiKey()) {
      setJimakuStatus(t("statusJimakuNeedKey"));
      if (jimakuApiKeyInput) jimakuApiKeyInput.focus();
      return;
    }
    const query = String(jimakuQueryInput && jimakuQueryInput.value ? jimakuQueryInput.value : "").trim();
    if (!query) {
      setJimakuStatus(t("statusJimakuNeedQuery"));
      if (jimakuQueryInput) jimakuQueryInput.focus();
      return;
    }
    clearJimakuSelection();
    const requestToken = ++state.jimakuSearchToken;
    setJimakuStatus(t("statusJimakuSearching", { type: getJimakuMediaTypeLabel(), query }));
    const entries = await fetchJimakuEntries(query);
    if (requestToken !== state.jimakuSearchToken) {
      return;
    }
    renderJimakuEntries(entries);
    setJimakuStatus(t("statusJimakuEntries", { count: entries.length, type: getJimakuMediaTypeLabel() }));
  }

  async function loadJimakuFiles(entry) {
    const requestToken = ++state.jimakuFilesToken;
    debugJimaku("loadFilesStart", {
      requestToken,
      entryId: entry && entry.id ? entry.id : "",
      entryName: entry && entry.name ? entry.name : "",
      episode: jimakuEpisodeInput ? jimakuEpisodeInput.value : ""
    });
    state.jimakuSelectedEntry = entry;
    state.jimakuSelectedQuery = String(jimakuQueryInput && jimakuQueryInput.value ? jimakuQueryInput.value : "").trim();
    clearJimakuSelectedFiles();
    const episode = jimakuEpisodeInput ? jimakuEpisodeInput.value : "";
    setJimakuStatus(t("statusJimakuReadFiles", { entry: entry.name || entry.id }));
    const files = await fetchJimakuFiles(entry.id, episode);
    if (requestToken !== state.jimakuFilesToken) {
      debugJimaku("loadFilesStale", {
        requestToken,
        currentToken: state.jimakuFilesToken
      });
      return;
    }
    debugJimaku("loadFilesDone", {
      requestToken,
      filesCount: Array.isArray(files) ? files.length : 0
    });
    renderJimakuFiles(files);
    setJimakuStatus(t("statusJimakuFiles", { count: files.length }));
  }

  async function loadJimakuSubtitle(file) {
    debugJimaku("loadSubtitleStart", {
      fileName: file && file.name ? file.name : "",
      fileUrl: file && file.url ? file.url : "",
      blockedByInFlight: !!state.jimakuImportInFlight
    });
    if (state.jimakuImportInFlight) return;
    state.jimakuImportInFlight = true;
    try {
      setJimakuStatus(t("statusJimakuDownload", { name: file.name || "" }));
      const subtitle = await importJimakuSubtitle(file);
      debugJimaku("loadSubtitleFetched", {
        fileName: file && file.name ? file.name : "",
        subtitleName: subtitle && subtitle.name ? subtitle.name : "",
        subtitleLength: subtitle && subtitle.text ? String(subtitle.text).length : 0
      });
      importSubtitleText(String(subtitle.text || ""), subtitle.name || file.name || "jimaku.srt", {
        source: "jimaku",
        entryLabel: state.jimakuSelectedEntry ? getJimakuEntryLabel(state.jimakuSelectedEntry) : ""
      });
      setJimakuStatus(t("statusJimakuImported", { name: subtitle.name || file.name || "" }));
      finishJimakuSuccessAndClose();
      debugJimaku("loadSubtitleDone", {
        fileName: file && file.name ? file.name : ""
      });
    } catch (error) {
      debugJimaku("loadSubtitleError", {
        fileName: file && file.name ? file.name : "",
        error: error && error.message ? error.message : String(error)
      });
      throw error;
    } finally {
      state.jimakuImportInFlight = false;
      debugJimaku("loadSubtitleFinally", {
        fileName: file && file.name ? file.name : ""
      });
    }
  }

  async function addSelectedJimakuFilesToQueue() {
    debugJimaku("queueImportStart", {
      blockedByInFlight: !!state.jimakuImportInFlight
    });
    if (state.jimakuImportInFlight) return;
    const selectedFiles = state.jimakuFiles.filter((file) => state.jimakuSelectedFileKeys.has(getJimakuFileKey(file)));
    debugJimaku("queueImportSelected", {
      selectedFiles: selectedFiles.map((file) => (file && file.name ? file.name : ""))
    });
    if (!selectedFiles.length) {
      setJimakuStatus(t("statusJimakuNeedSelectFiles"));
      return;
    }
    state.jimakuImportInFlight = true;
    try {
      const queueItems = [];
      for (const file of selectedFiles) {
        setJimakuStatus(t("statusJimakuDownload", { name: file.name || "" }));
        const subtitle = await importJimakuSubtitle(file);
        debugJimaku("queueImportFetchedOne", {
          fileName: file && file.name ? file.name : "",
          subtitleName: subtitle && subtitle.name ? subtitle.name : "",
          subtitleLength: subtitle && subtitle.text ? String(subtitle.text).length : 0
        });
        const name = subtitle.name || file.name || "jimaku.srt";
        const cues = parseSubtitleTextToCues(String(subtitle.text || ""), name);
        queueItems.push(
          makeSubtitleQueueItem(name, cues, {
            source: "jimaku",
            entryLabel: state.jimakuSelectedEntry ? getJimakuEntryLabel(state.jimakuSelectedEntry) : ""
          })
        );
      }
      addSubtitleQueueItems(queueItems, { activateFirst: true });
      setJimakuStatus(t("statusSubtitleQueueAdded", { count: queueItems.length }));
      finishJimakuSuccessAndClose();
      debugJimaku("queueImportDone", {
        queueItems: queueItems.length
      });
    } catch (error) {
      debugJimaku("queueImportError", {
        error: error && error.message ? error.message : String(error)
      });
      throw error;
    } finally {
      state.jimakuImportInFlight = false;
      debugJimaku("queueImportFinally");
    }
  }

  function clearSubtitle() {
    state.subtitleQueue = [];
    state.subtitleQueueIndex = -1;
    setQuickQueueOpen(false);
    state.subtitles = [];
    state.activeCue = null;
    state.cueRangeSelection = null;
    state.rangePanelEntry = null;
    state.subtitleOverlayHidden = false;
    clearSwipeJumpChain();
    closeRangePopup();
    setLauncherSelectionActive(false);
    setQuickSubtitleButtonLabel();
    if (state.videoRefreshHandle) {
      clearInterval(state.videoRefreshHandle);
      state.videoRefreshHandle = null;
    }
    positionOverlayToVideo(null);
    renderSubtitleQueue();
    renderSubtitleList();
    setSubtitleMeta(t("noSubtitleImported"));
    showSubtitleEmpty(t("statusSubtitleCleared"));
    setStatus(t("statusSubtitleCleared"));
  }

  function jumpToCueIndex(index) {
    const video = getTrackedVideo();
    if (!video || !state.subtitles.length) return;
    const safeIndex = Math.max(0, Math.min(state.subtitles.length - 1, Number(index)));
    const cueWindow = getCueMediaWindowFromIndices(safeIndex, safeIndex);
    const start = Math.max(0, Number(cueWindow.start || 0));
    const end = Math.max(start + 0.05, Number(cueWindow.end || start + 0.05));
    const offset = getSubtitleOffsetSeconds();
    let nextTime = Math.min(end - 0.01, start + 0.01);

    if (safeIndex > 0) {
      const previousCue = state.subtitles[safeIndex - 1];
      const previousEnd = Number(previousCue && previousCue.end ? previousCue.end : 0) + offset;
      if (previousEnd >= nextTime) {
        nextTime = Math.min(end - 0.01, Math.max(nextTime, previousEnd + 0.01));
      }
    }

    if (safeIndex < state.subtitles.length - 1) {
      const nextCue = state.subtitles[safeIndex + 1];
      const nextStart = Number(nextCue && nextCue.start ? nextCue.start : end) + offset;
      if (nextStart <= end) {
        nextTime = Math.max(start + 0.01, Math.min(nextTime, nextStart - 0.01));
      }
    }

    if (!Number.isFinite(nextTime) || nextTime < start || nextTime > end) {
      nextTime = start + Math.max(0.01, (end - start) * 0.5);
    }

    pushSwipeDebugLog("jumpToCueIndex", {
      requestedIndex: Number(index),
      safeIndex,
      currentTime: Number(video.currentTime || 0),
      targetStart: start,
      targetEnd: end,
      nextTime,
      previousMatchIndices: getMatchingCueIndicesAtTime(Number(video.currentTime || 0)),
      nextCueText: String((state.subtitles[safeIndex] && state.subtitles[safeIndex].text) || "").slice(0, 80)
    });
    rememberSwipeJumpIndex(safeIndex);
    video.currentTime = Math.max(0, nextTime);
    refreshSubtitleFromVideo();
    pushSwipeDebugLog("jumpToCueIndexAfterSeek", {
      safeIndex,
      actualTime: Number(video.currentTime || 0),
      activeCueIndex: getCueIndex(state.activeCue),
      matchIndices: getMatchingCueIndicesAtTime(Number(video.currentTime || 0)),
      chainedIndex: getRecentSwipeJumpIndex()
    });
  }

  function getActiveCueIndexAtTime(time) {
    const cue = findActiveCue(Number(time || 0));
    return cue ? getCueIndex(cue) : -1;
  }

  function getDirectionalCueTargetIndex(time, delta) {
    const total = Array.isArray(state.subtitles) ? state.subtitles.length : 0;
    if (!total) return -1;
    const offset = getSubtitleOffsetSeconds();
    const numericTime = Number(time || 0);

    if (delta > 0) {
      for (let index = 0; index < total; index += 1) {
        const cue = state.subtitles[index];
        const cueStart = Number(cue && cue.start ? cue.start : 0) + offset;
        if (cueStart > numericTime) {
          return index;
        }
      }
      return total - 1;
    }

    if (delta < 0) {
      for (let index = total - 1; index >= 0; index -= 1) {
        const cue = state.subtitles[index];
        const cueEnd = Number(cue && cue.end ? cue.end : 0) + offset;
        if (cueEnd < numericTime) {
          return index;
        }
      }
      return 0;
    }

    return -1;
  }

  function jumpByCue(delta) {
    if (!state.subtitles.length) return;
    const video = getTrackedVideo();
    if (!video) return;
    const recentSwipeIndex = getRecentSwipeJumpIndex();
    const currentTimeIndex = getActiveCueIndexAtTime(video.currentTime);
    const activeCueIndex = getCueIndex(state.activeCue);
    const directionalTargetIndex =
      recentSwipeIndex < 0 && currentTimeIndex < 0 && activeCueIndex < 0
        ? getDirectionalCueTargetIndex(video.currentTime, delta)
        : -1;
    const currentIndex =
      recentSwipeIndex >= 0
        ? recentSwipeIndex
        : currentTimeIndex >= 0
          ? currentTimeIndex
          : activeCueIndex;
    pushSwipeDebugLog("jumpByCue", {
      delta,
      trackedVideoCurrentTime: Number(video.currentTime || 0),
      activeCueIndex,
      currentTimeIndex,
      recentSwipeIndex,
      directionalTargetIndex,
      chosenIndex: currentIndex,
      matchIndices: getMatchingCueIndicesAtTime(Number(video.currentTime || 0)),
      trackedVideoSrc: String(video.currentSrc || video.src || "").slice(0, 120)
    });
    if (directionalTargetIndex >= 0) {
      jumpToCueIndex(directionalTargetIndex);
      return;
    }
    jumpToCueIndex(Math.max(0, currentIndex) + delta);
  }

  function jumpByTime(deltaSeconds) {
    const video = getTrackedVideo();
    if (!video) return;
    clearSwipeJumpChain();
    const duration = Number(video.duration || 0);
    const currentTime = Number(video.currentTime || 0);
    const nextTime = Math.max(0, Number(video.currentTime || 0) + Number(deltaSeconds || 0));
    pushSwipeDebugLog("jumpByTime", {
      deltaSeconds: Number(deltaSeconds || 0),
      currentTime,
      unclampedNextTime: nextTime,
      duration
    });
    video.currentTime = Number.isFinite(duration) && duration > 0 ? Math.min(duration, nextTime) : nextTime;
    refreshSubtitleFromVideo();
    pushSwipeDebugLog("jumpByTimeAfterSeek", {
      actualTime: Number(video.currentTime || 0),
      matchIndices: getMatchingCueIndicesAtTime(Number(video.currentTime || 0))
    });
  }

  function handleSwipeJumpDirection(direction) {
    if (direction === 0 || !state.subtitles.length) return;
    pushSwipeDebugLog("handleSwipeJumpDirection", {
      direction,
      mode: state.swipeJumpMode,
      stepSeconds: Number(state.swipeJumpStepSeconds || 0)
    });
    if (state.swipeJumpMode === "time") {
      jumpByTime(direction * Number(state.swipeJumpStepSeconds || 1));
      return;
    }
    jumpByCue(direction > 0 ? 1 : -1);
  }

  function closeLookupPopup() {
    invalidateLookupRequestState();
    lookupPopup.classList.add("ankiouo-hidden");
    closeRangePopup();
    resumeVideoAfterLookupPause();
  }

  function resumeVideoAfterLookupPause() {
    const video =
      state.trackedVideo && document.contains(state.trackedVideo)
        ? state.trackedVideo
        : getTrackedVideo();
    if (state.resumeOnPopupClose && video && typeof video.play === "function") {
      state.resumeOnPopupClose = false;
      const maybePromise = video.play();
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch(() => {});
      }
      return;
    }
    state.resumeOnPopupClose = false;
  }

  function togglePanel() {
    panel.classList.toggle("ankiouo-hidden");
    if (!panel.classList.contains("ankiouo-hidden")) {
      queryInput.focus();
    }
  }

  function toggleSubtitleOverlayVisibility() {
    if (state.subtitleOverlayHidden) {
      showSubtitleOverlay();
    } else {
      hideSubtitleOverlay();
    }
    rerenderActiveSubtitleOverlay();
  }

  function beginSubtitleDrag(clientX, clientY) {
    if (state.subtitlePositionMode !== "custom") return;
    const rect = videoOverlay.getBoundingClientRect();
    state.subtitleDragActive = true;
    state.subtitleDragPending = false;
    state.subtitleDragOffsetX = clientX - rect.left;
    state.subtitleDragOffsetY = clientY - rect.top;
  }

  function updateSubtitleDrag(clientX, clientY) {
    if (!state.subtitleDragActive || state.subtitlePositionMode !== "custom") return;
    const y = clientY - state.subtitleDragOffsetY;
    const clampedY = Math.max(8, Math.min(window.innerHeight - 42, y));
    state.customSubtitleY = clampedY;
    void persistCustomSubtitleY(clampedY);
    videoOverlay.style.top = `${clampedY}px`;
    videoOverlay.style.bottom = "auto";
  }

  function endSubtitleDrag() {
    state.subtitleDragActive = false;
    state.subtitleDragPending = false;
    state.subtitleDragPointerId = 0;
  }

  if (EXTENSION_API && EXTENSION_API.runtime && EXTENSION_API.runtime.onMessage) {
    EXTENSION_API.runtime.onMessage.addListener((message) => {
      if (!message || message.type !== "ankiouoTogglePanel") {
        return;
      }
      togglePanel();
    });
  }

  function useSelection() {
    const selected = String(window.getSelection ? window.getSelection().toString() : "").trim();
    if (!selected) {
      setStatus(t("statusNoTextSelection"));
      return;
    }

    queryInput.value = selected;
    handleSearch();
  }

  async function sendPayloadToDesktop(serverUrl, payload, options = {}) {
    const mediaSnapshot = options.mediaSnapshot || {};
    const formData = buildDesktopAnkiFormData(payload, {
      includeBinaryFromState: options.includeBinaryFromState !== false,
      mediaSnapshot
    });
    let response = null;
    const failureReasons = [];

    try {
      const raw = await fetchWithTimeout(
        serverUrl,
        {
          method: "POST",
          body: formData
        },
        options.timeoutMs || DESKTOP_REQUEST_TIMEOUT_MS
      );

      const text = await raw.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (error) {
        data = null;
      }

      response = raw.ok && (!data || data.ok !== false)
        ? { ok: true, data: data || { ok: true } }
        : { ok: false, error: (data && (data.error || data.message)) || text || `HTTP ${raw.status}`, data };
    } catch (directFetchError) {
      failureReasons.push(`direct fetch: ${directFetchError && directFetchError.message ? directFetchError.message : String(directFetchError)}`);
      if (hasRuntimeMessaging()) {
        try {
          const includeBinary = options.includeBinaryFromState !== false;
          response = await sendRuntimeMessage({
            type: "sendToDesktopAnkiServer",
            url: serverUrl,
            payload,
            screenshotDataUrl: includeBinary ? mediaSnapshot.screenshotDataUrl || "" : "",
          });
          if (!response) {
            failureReasons.push("background fetch: empty response");
          }
        } catch (backgroundError) {
          failureReasons.push(`background fetch: ${backgroundError && backgroundError.message ? backgroundError.message : String(backgroundError)}`);
        }
      }
    }

    if (!response && failureReasons.includes("background fetch: empty response")) {
      return { ok: true, pending: true, data: {} };
    }
    if (!response || !response.ok) {
      let details = [(response && response.error) || "", ...failureReasons].filter(Boolean).join(" | ");
      const looksGeneric500 =
        /(^|[\s|:])HTTP 500($|[\s|])/.test(details) ||
        /background fetch:\s*HTTP 500/.test(details);
      if (looksGeneric500) {
        const importError = await fetchDesktopImportError(serverUrl);
        if (importError) {
          details = `${details} | bridge error: ${importError}`;
        }
      }
      return { ok: false, error: details || t("statusDesktopSendFailed", { error: "Unknown error" }) };
    }
    return { ok: true, data: response.data || {} };
  }

  async function sendToDesktopAnki(options = {}) {
    try {
      const serverUrl = getDesktopAnkiUrlValue();
      setLookupStatus(t("statusPreparingScreenshot"));
      setStatus(t("statusPreparingScreenshot"));
      const exportSnapshot = createDesktopExportSnapshot();
      const mediaSnapshot = await prepareDesktopAnkiMedia();
      const payload = buildDesktopAnkiPayload(mediaSnapshot, exportSnapshot);
      const mediaReady = `media ready | image:${mediaSnapshot.screenshotDataUrl ? "yes" : "no"}`;
      setStatus(mediaReady);
      setLookupStatus(mediaReady);
      setStatus(t("statusDesktopSending"));
      setLookupStatus(t("statusDesktopSending"));

      const sendResult = await sendPayloadToDesktop(serverUrl, payload, {
        includeBinaryFromState: true,
        mediaSnapshot
      });
      if (sendResult.ok && sendResult.pending) {
        setStatus(t("statusDesktopQueued"));
        setLookupStatus(t("statusDesktopQueued"));
        return;
      }
      if (!sendResult.ok) {
        throw new Error(sendResult.error || t("statusDesktopSendFailed", { error: "Unknown error" }));
      }

      const resultData = sendResult.data || {};
      const noteId = resultData.noteId ? resultData.noteId : "";
      const audioStored = Boolean(resultData.audioStored);
      const imageStored = Boolean(resultData.imageStored);
      const summary = `${noteId ? `noteId: ${noteId}` : "sent"} | audio: ${audioStored ? "yes" : "no"} | image: ${imageStored ? "yes" : "no"}`;
      setStatus(summary);
      setLookupStatus(summary);
    } catch (error) {
      setStatus(t("statusDesktopSendFailed", { error: error.message }));
      setLookupStatus(t("statusDesktopSendFailed", { error: error.message }));
      throw error;
    }
  }

  async function init() {
    try {
      state.language = await readStoredLanguage();
      applyLanguage();
      state.lookupCssEnabled = await readStoredLookupCssEnabled();
      if (lookupCssToggle) {
        lookupCssToggle.checked = state.lookupCssEnabled;
      }
      state.subtitlePositionMode = await readStoredSubtitlePositionMode();
      state.customSubtitleY = await readStoredCustomSubtitleY();
      state.subtitleBackgroundEnabled = await readStoredSubtitleBackgroundEnabled();
      state.subtitleBackgroundStyle = await readStoredSubtitleBackgroundStyle();
      state.swipeJumpEnabled = await readStoredSwipeJumpEnabled();
      state.swipeJumpMode = await readStoredSwipeJumpMode();
      state.swipeJumpStepSeconds = await readStoredSwipeJumpStep();
      state.launcherSelectionBehavior = await readStoredLauncherSelectionBehavior();
      state.launcherSelectionOpacity = await readStoredLauncherSelectionOpacity();
      state.quickQueueButtonEnabled = await readStoredQuickQueueButtonEnabled();
      state.quickYomitanButtonEnabled = await readStoredQuickYomitanButtonEnabled();
      state.subtitleQueueUiEnabled = await readStoredSubtitleQueueUiEnabled();
      applySubtitleBlurUi();
      applySwipeJumpUi();
      syncLauncherUi();
      renderSubtitleQueue();
      const savedDesktopUrl = await readStoredDesktopAnkiUrl();
      if (desktopAnkiUrlInput) {
        desktopAnkiUrlInput.value = getDesktopAnkiHost(savedDesktopUrl || DEFAULT_DESKTOP_ANKI_URL);
      }
      applyJimakuConfig(await readStoredJimakuConfig());

      setMeta("");
      showResultsEmpty(t("startBridgeHint"));
      showSubtitleEmpty(t("subtitleFollowHint"));
      setJimakuStatus(
        getJimakuApiKey()
          ? t("statusJimakuSaved", { type: getJimakuMediaTypeLabel() })
          : t("statusJimakuNeedKey")
      );
    } catch (error) {
      setStatus(t("statusInitFailed", { error: error.message }));
    }
  }

  if (launcher) launcher.addEventListener("click", togglePanel);
  if (quickSubtitleToggleButton) quickSubtitleToggleButton.addEventListener("click", toggleSubtitleOverlayVisibility);
  if (quickSubtitleListButton) {
    quickSubtitleListButton.addEventListener("click", () => {
      if (!state.subtitles.length) return;
      toggleSubtitleListPanel();
    });
  }
  if (closeSubtitleListButton) closeSubtitleListButton.addEventListener("click", closeSubtitleListPanel);
  if (quickSwipeJumpButton) {
    quickSwipeJumpButton.addEventListener("click", () => {
      if (!state.subtitles.length) return;
      void persistSwipeJumpEnabled(!state.swipeJumpEnabled);
    });
  }
  if (quickQueueToggleButton) {
    quickQueueToggleButton.addEventListener("click", () => {
      setQuickQueueOpen(!isQuickQueueOpen());
      syncLauncherUi();
    });
  }
  if (closePanelButton) closePanelButton.addEventListener("click", () => panel.classList.add("ankiouo-hidden"));
  if (importSubtitleButton) importSubtitleButton.addEventListener("click", () => subtitleFile.click());
  if (clearSubtitleButton) clearSubtitleButton.addEventListener("click", clearSubtitle);
  if (openJimakuModalButton) {
    openJimakuModalButton.addEventListener("click", () => {
      panel.classList.add("ankiouo-hidden");
      openJimakuModal();
    });
  }
  if (closeJimakuModalButton) closeJimakuModalButton.addEventListener("click", closeJimakuModal);
  if (jimakuBackButton) {
    jimakuBackButton.addEventListener("click", () => {
      clearJimakuSelection({ keepFiles: true });
      setJimakuStatus(t("statusJimakuBack", { type: getJimakuMediaTypeLabel() }));
    });
  }
  if (jimakuTypeAnimeButton) {
    jimakuTypeAnimeButton.addEventListener("click", () => {
      setJimakuMediaType("anime").catch((error) => setJimakuStatus(t("statusJimakuTypeFailed", { error: error.message })));
    });
  }
  if (jimakuTypeLiveActionButton) {
    jimakuTypeLiveActionButton.addEventListener("click", () => {
      setJimakuMediaType("live_action").catch((error) => setJimakuStatus(t("statusJimakuTypeFailed", { error: error.message })));
    });
  }
  if (saveJimakuKeyButton) {
    saveJimakuKeyButton.addEventListener("click", () => {
      saveJimakuApiKey().catch((error) => setJimakuStatus(t("statusJimakuSaveFailed", { error: error.message })));
    });
  }
  if (jimakuApiKeyInput) {
    jimakuApiKeyInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveJimakuApiKey().catch((error) => setJimakuStatus(t("statusJimakuSaveFailed", { error: error.message })));
      }
    });
  }
  if (jimakuSearchButton) {
    jimakuSearchButton.addEventListener("click", () => {
      searchJimaku().catch((error) => setJimakuStatus(t("statusJimakuSearchFailed", { error: error.message })));
    });
  }
  if (jimakuFilesSelectAllButton) {
    jimakuFilesSelectAllButton.addEventListener("click", () => {
      if (!isJimakuQueueMode()) return;
      state.jimakuFiles.forEach((file) => {
        if (isSupportedJimakuSubtitle(file.name)) {
          setJimakuSelectedFileKey(getJimakuFileKey(file), true);
        }
      });
      renderJimakuFiles(state.jimakuFiles);
    });
  }
  if (jimakuFilesClearSelectionButton) {
    jimakuFilesClearSelectionButton.addEventListener("click", () => {
      clearJimakuSelectedFiles();
      renderJimakuFiles(state.jimakuFiles);
    });
  }
  if (jimakuFilesAddSelectedButton) {
    jimakuFilesAddSelectedButton.addEventListener("click", () => {
      debugJimaku("queueImportButtonClick");
      addSelectedJimakuFilesToQueue().catch((error) => setJimakuStatus(t("statusJimakuImportFailed", { error: error.message })));
    });
  }
  if (jimakuQueryInput) {
    jimakuQueryInput.addEventListener("input", () => {
      state.jimakuSearchToken += 1;
      const currentQuery = String(jimakuQueryInput.value || "").trim();
      if (state.jimakuSelectedEntry && currentQuery !== state.jimakuSelectedQuery) {
        clearJimakuSelection({ keepFiles: true });
      }
    });
    jimakuQueryInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        searchJimaku().catch((error) => setJimakuStatus(t("statusJimakuSearchFailed", { error: error.message })));
      }
    });
  }
  if (jimakuEpisodeInput) {
    jimakuEpisodeInput.addEventListener("change", () => {
      const episodeValue = String(jimakuEpisodeInput.value || "");
      if (episodeValue === String(state.jimakuSkipNextEpisodeChangeValue || "")) {
        state.jimakuSkipNextEpisodeChangeValue = "";
        debugJimaku("episodeChangeSkippedAfterEnter", {
          episode: episodeValue
        });
        return;
      }
      state.jimakuSkipNextEpisodeChangeValue = "";
      clearJimakuSelectedFiles();
      if (state.jimakuSelectedEntry) {
        renderJimakuFiles(state.jimakuFiles);
        loadJimakuFiles(state.jimakuSelectedEntry).catch((error) => setJimakuStatus(t("statusJimakuFilesFailed", { error: error.message })));
      }
    });
    jimakuEpisodeInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        state.jimakuSkipNextEpisodeChangeValue = String(jimakuEpisodeInput.value || "");
        if (state.jimakuSelectedEntry) {
          loadJimakuFiles(state.jimakuSelectedEntry).catch((error) => setJimakuStatus(t("statusJimakuFilesFailed", { error: error.message })));
        } else {
          searchJimaku().catch((error) => setJimakuStatus(t("statusJimakuSearchFailed", { error: error.message })));
        }
      }
    });
  }
  if (quickYomitanCheckButton) {
    quickYomitanCheckButton.addEventListener("click", () => {
      quickCheckYomitanApiConnection().catch((error) => {
        const message = error && error.message ? error.message : String(error);
        setQuickYomitanButtonIcon("failure");
        setQuickYomitanButtonLabel("Yomitan");
        setStatus(t("statusYomitanFailed", { message }));
        if (quickYomitanCheckButton) quickYomitanCheckButton.disabled = false;
      });
    });
    setQuickYomitanButtonIcon("default");
    setQuickYomitanButtonLabel("Yomitan");
  }
  if (checkYomitanApiButton) {
    checkYomitanApiButton.addEventListener("click", () => {
      checkYomitanApiButton.disabled = true;
      panelCheckYomitanApiConnection()
        .catch((error) => {
          const message = error && error.message ? error.message : String(error);
          setStatus(t("statusYomitanFailed", { message }));
        })
        .finally(() => {
          checkYomitanApiButton.disabled = false;
        });
    });
  }
  if (searchButton) searchButton.addEventListener("click", handleSearch);
  if (useSelectionButton) useSelectionButton.addEventListener("click", useSelection);
  if (sendDesktopAnkiButton) sendDesktopAnkiButton.addEventListener("click", sendToDesktopAnki);
  if (closePopupButton) closePopupButton.addEventListener("click", closeLookupPopup);
  if (rangeAddAnkiButton) {
    rangeAddAnkiButton.addEventListener("pointerdown", (event) => {
      debugRange("addButtonPointerDown", {
        targetTag: event.target && event.target.tagName ? event.target.tagName : "",
        pointerType: event.pointerType || ""
      });
      event.stopPropagation();
    });
  }
  if (rangeAddAnkiButton) {
    rangeAddAnkiButton.addEventListener("click", async (event) => {
      debugRange("addButtonClick", {
        targetTag: event.target && event.target.tagName ? event.target.tagName : ""
      });
      event.preventDefault();
      event.stopPropagation();
      const entry = state.rangePanelEntry || state.lastLookupEntry || (state.currentResults && state.currentResults[0]);
      try {
        await addAnkiForEntry(entry, { closeRangeImmediately: true });
      } catch (error) {
        setLookupStatus(t("statusAutoSendFailed", { error: error.message }));
        setStatus(t("statusAutoSendFailed", { error: error.message }));
      }
    });
  }
  if (closeRangePopupButton) {
    closeRangePopupButton.addEventListener("pointerdown", (event) => {
      debugRange("closeButtonPointerDown", {
        targetTag: event.target && event.target.tagName ? event.target.tagName : "",
        pointerType: event.pointerType || ""
      });
      event.stopPropagation();
    });
    closeRangePopupButton.addEventListener("click", (event) => {
      debugRange("closeButtonClick", {
        targetTag: event.target && event.target.tagName ? event.target.tagName : ""
      });
      event.preventDefault();
      event.stopPropagation();
      closeRangePopup();
    });
  }
  if (rangePopup) {
    rangePopup.addEventListener(
      "pointerdown",
      (event) => {
        const target = event.target;
        debugRange("popupPointerDownCapture", {
          targetTag: target && target.tagName ? target.tagName : "",
          targetClass:
            target && typeof target.className === "string"
              ? target.className
              : "",
          targetAction:
            target && target.closest && target.closest("[data-action]")
              ? target.closest("[data-action]").getAttribute("data-action") || ""
              : "",
          pointerType: event.pointerType || ""
        });
      },
      true
    );
    rangePopup.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        debugRange("popupClickCapture", {
          targetTag: target && target.tagName ? target.tagName : "",
          targetClass:
            target && typeof target.className === "string"
              ? target.className
              : "",
          targetAction:
            target && target.closest && target.closest("[data-action]")
              ? target.closest("[data-action]").getAttribute("data-action") || ""
              : ""
        });
      },
      true
    );
  }
  if (rangeStartInput) rangeStartInput.addEventListener("input", applyRangePopupSelection);
  if (rangeEndInput) rangeEndInput.addEventListener("input", applyRangePopupSelection);
  if (pauseOnLookupToggle) {
    pauseOnLookupToggle.addEventListener("change", () => {
      state.pauseOnSubtitleLookup = pauseOnLookupToggle.checked;
      setStatus(state.pauseOnSubtitleLookup ? t("statusPauseOn") : t("statusPauseOff"));
    });
  }
  if (closeLookupAfterAddToggle) {
    closeLookupAfterAddToggle.addEventListener("change", () => {
      state.closeLookupAfterAdd = closeLookupAfterAddToggle.checked;
      setStatus(state.closeLookupAfterAdd ? t("statusCloseLookupOn") : t("statusCloseLookupOff"));
    });
  }
  if (lookupCssToggle) {
    lookupCssToggle.addEventListener("change", () => {
      void persistLookupCssEnabled(lookupCssToggle.checked);
      setStatus(lookupCssToggle.checked ? t("statusLookupCssOn") : t("statusLookupCssOff"));
    });
  }
  if (subtitleBackgroundToggle) {
    subtitleBackgroundToggle.addEventListener("change", () => {
      void persistSubtitleBackgroundEnabled(subtitleBackgroundToggle.checked);
      setStatus(subtitleBackgroundToggle.checked ? t("statusSubtitleBackgroundOn") : t("statusSubtitleBackgroundOff"));
    });
  }
  if (subtitleBackgroundStylePlateButton) {
    subtitleBackgroundStylePlateButton.addEventListener("click", () => {
      void persistSubtitleBackgroundStyle("plate");
      setStatus(t("statusSubtitleBackgroundStylePlate"));
    });
  }
  if (subtitleBackgroundStyleGlassButton) {
    subtitleBackgroundStyleGlassButton.addEventListener("click", () => {
      void persistSubtitleBackgroundStyle("glass");
      setStatus(t("statusSubtitleBackgroundStyleGlass"));
    });
  }
  if (launcherSelectionBehaviorSelect) {
    launcherSelectionBehaviorSelect.addEventListener("change", () => {
      void persistLauncherSelectionBehavior(launcherSelectionBehaviorSelect.value);
    });
  }
  if (launcherSelectionOpacityInput) {
    launcherSelectionOpacityInput.addEventListener("input", () => {
      void persistLauncherSelectionOpacity(Number(launcherSelectionOpacityInput.value || 0.24));
    });
  }
  if (quickQueueButtonToggle) {
    quickQueueButtonToggle.addEventListener("change", () => {
      void persistQuickQueueButtonEnabled(quickQueueButtonToggle.checked);
    });
  }
  if (quickYomitanButtonToggle) {
    quickYomitanButtonToggle.addEventListener("change", () => {
      void persistQuickYomitanButtonEnabled(quickYomitanButtonToggle.checked);
    });
  }
  if (subtitleQueueUiToggle) {
    subtitleQueueUiToggle.addEventListener("change", () => {
      const enabled = subtitleQueueUiToggle.checked;
      if (!enabled && state.quickQueueButtonEnabled) {
        void persistQuickQueueButtonEnabled(false);
      }
      void persistSubtitleQueueUiEnabled(enabled);
    });
  }
  if (languageSelect) {
    languageSelect.addEventListener("change", () => {
      void persistLanguage(languageSelect.value);
    });
  }
  if (desktopAnkiUrlInput) {
    desktopAnkiUrlInput.addEventListener("change", () => {
      void persistDesktopAnkiUrl(desktopAnkiUrlInput.value);
      setStatus(t("statusDesktopUpdated"));
    });
    desktopAnkiUrlInput.addEventListener("blur", () => {
      void persistDesktopAnkiUrl(desktopAnkiUrlInput.value);
    });
  }
  if (subtitlePosBottomButton) {
    subtitlePosBottomButton.addEventListener("click", () => setSubtitlePositionMode("bottom"));
  }
  if (subtitlePosTopButton) {
    subtitlePosTopButton.addEventListener("click", () => setSubtitlePositionMode("top"));
  }
  if (subtitlePosCustomButton) {
    subtitlePosCustomButton.addEventListener("click", () => setSubtitlePositionMode("custom"));
  }
  if (subtitlePosResetButton) {
    subtitlePosResetButton.addEventListener("click", resetCustomSubtitlePosition);
  }
  if (subtitleOffsetMinusButton) {
    subtitleOffsetMinusButton.addEventListener("click", () => {
      setSubtitleOffsetSeconds(getSubtitleOffsetSeconds() - 0.5);
    });
  }
  if (subtitleOffsetPlusButton) {
    subtitleOffsetPlusButton.addEventListener("click", () => {
      setSubtitleOffsetSeconds(getSubtitleOffsetSeconds() + 0.5);
    });
  }
  if (subtitleOffsetResetButton) {
    subtitleOffsetResetButton.addEventListener("click", () => {
      setSubtitleOffsetSeconds(0);
    });
  }
  if (subtitleOffsetInput) {
    subtitleOffsetInput.addEventListener("change", () => {
      setSubtitleOffsetSeconds(Number(subtitleOffsetInput.value || 0));
    });
    subtitleOffsetInput.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 && event.pointerType !== "touch") return;
      if (event.pointerType !== "touch") {
        return;
      }
      beginSubtitleOffsetDrag(event);
    });
    subtitleOffsetInput.addEventListener("pointermove", (event) => {
      updateSubtitleOffsetDrag(event);
    });
    subtitleOffsetInput.addEventListener("pointerup", (event) => {
      endSubtitleOffsetDrag(event);
    });
    subtitleOffsetInput.addEventListener("pointercancel", (event) => {
      endSubtitleOffsetDrag(event);
    });
  }
  if (subtitleQueuePrevButton) {
    subtitleQueuePrevButton.addEventListener("click", () => stepSubtitleQueue(-1));
  }
  if (subtitleQueueNextButton) {
    subtitleQueueNextButton.addEventListener("click", () => stepSubtitleQueue(1));
  }
  if (subtitleQueueClearButton) {
    subtitleQueueClearButton.addEventListener("click", clearSubtitle);
  }
  if (swipeJumpToggle) {
    swipeJumpToggle.addEventListener("change", () => {
      void persistSwipeJumpEnabled(swipeJumpToggle.checked);
      setStatus(t(swipeJumpToggle.checked ? "statusSwipeJumpOn" : "statusSwipeJumpOff"));
    });
  }
  if (swipeModeCueButton) {
    swipeModeCueButton.addEventListener("click", () => {
      void persistSwipeJumpMode("cue");
    });
  }
  if (swipeModeTimeButton) {
    swipeModeTimeButton.addEventListener("click", () => {
      void persistSwipeJumpMode("time");
    });
  }
  if (swipeJumpStepInput) {
    swipeJumpStepInput.addEventListener("change", () => {
      void persistSwipeJumpStep(Number(swipeJumpStepInput.value || 5));
    });
  }
  subtitleFile.addEventListener("change", async () => {
    const files = subtitleFile.files ? Array.from(subtitleFile.files) : [];
    if (!files.length) {
      return;
    }

    try {
      await importSubtitles(files, { source: "local" });
    } catch (error) {
      setStatus(t("statusSubtitleImportFailed", { error: error.message }));
    } finally {
      subtitleFile.value = "";
    }
  });
  queryInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch();
    }
  });

  window.addEventListener("resize", () => {
    if (state.trackedVideo) {
      positionOverlayToVideo(state.trackedVideo);
    }
    applySwipeJumpUi();
  });

  document.addEventListener("fullscreenchange", () => {
    syncRootContainer(state.trackedVideo);
    syncVideoOverlayContainer(state.trackedVideo);
    if (state.trackedVideo) {
      positionOverlayToVideo(state.trackedVideo);
    } else {
      positionOverlayToVideo(getTrackedVideo());
    }
  });

  window.addEventListener(
    "scroll",
    () => {
      if (state.trackedVideo) {
        positionOverlayToVideo(state.trackedVideo);
      }
    },
    { passive: true }
  );

  window.addEventListener("beforeunload", () => {
    releaseAudioClipUrl();
    releaseScreenshotUrl();
    if (fullscreenOverlayHost && fullscreenOverlayHost.isConnected) {
      fullscreenOverlayHost.remove();
    }
  });

  videoOverlay.addEventListener("pointerdown", (event) => {
    if (state.subtitlePositionMode !== "custom") return;
    if (event.button !== 0 && event.pointerType !== "touch") return;
    const subtitleTarget = event.target && event.target.closest ? event.target.closest(".ankiouo-subtitle-line") : null;
    if (!subtitleTarget) return;
    state.subtitleDragPending = true;
    state.subtitleDragPointerId = event.pointerId;
    state.subtitleDragStartX = event.clientX;
    state.subtitleDragStartY = event.clientY;
  });
  videoOverlay.addEventListener("pointermove", (event) => {
    if (
      state.subtitlePositionMode === "custom" &&
      state.subtitleDragPending &&
      state.subtitleDragPointerId === event.pointerId &&
      !state.subtitleDragActive
    ) {
      const deltaX = event.clientX - state.subtitleDragStartX;
      const deltaY = event.clientY - state.subtitleDragStartY;
      if (Math.hypot(deltaX, deltaY) >= SUBTITLE_DRAG_THRESHOLD_PX) {
        event.preventDefault();
        event.stopPropagation();
        beginSubtitleDrag(event.clientX, event.clientY);
        videoOverlay.setPointerCapture(event.pointerId);
      }
    }
    if (state.subtitlePositionMode === "custom" && state.subtitleDragActive) {
      event.preventDefault();
      event.stopPropagation();
    }
    updateSubtitleDrag(event.clientX, event.clientY);
  });
  videoOverlay.addEventListener("pointerup", (event) => {
    if (state.subtitlePositionMode === "custom" && state.subtitleDragActive) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (state.subtitleDragPointerId === event.pointerId) {
      state.subtitleDragPending = false;
      state.subtitleDragPointerId = 0;
    }
    endSubtitleDrag();
  });
  videoOverlay.addEventListener("pointercancel", (event) => {
    if (state.subtitlePositionMode === "custom" && state.subtitleDragActive) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (state.subtitleDragPointerId === event.pointerId) {
      state.subtitleDragPending = false;
      state.subtitleDragPointerId = 0;
    }
    endSubtitleDrag();
  });
  if (swipeZone) {
    swipeZone.addEventListener("pointerdown", (event) => {
      if (!state.swipeJumpEnabled || !state.subtitles.length) return;
      if (event.button !== 0 && event.pointerType !== "touch") return;
      event.preventDefault();
      state.swipeZonePointerId = event.pointerId;
      state.swipeZoneStartX = event.clientX;
      state.swipeZoneStartY = event.clientY;
      state.swipeZonePointerMode = "gesture";
      swipeZone.setPointerCapture(event.pointerId);
    });
    swipeZone.addEventListener("pointermove", (event) => {
      if (state.swipeZonePointerId !== event.pointerId || !state.swipeJumpEnabled) return;
    });
    swipeZone.addEventListener("pointerup", (event) => {
      if (state.swipeZonePointerId !== event.pointerId || !state.swipeJumpEnabled) return;
      const deltaX = event.clientX - state.swipeZoneStartX;
      const deltaY = event.clientY - state.swipeZoneStartY;
      pushSwipeDebugLog("swipePointerUp", {
        deltaX,
        deltaY,
        startX: state.swipeZoneStartX,
        startY: state.swipeZoneStartY,
        endX: event.clientX,
        endY: event.clientY
      });
      if (Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY)) {
        handleSwipeJumpDirection(deltaX < 0 ? -1 : 1);
      }
      state.swipeZonePointerMode = "";
      state.swipeZonePointerId = 0;
    });
    swipeZone.addEventListener("pointercancel", (event) => {
      if (state.swipeZonePointerId !== event.pointerId) return;
      state.swipeZonePointerMode = "";
      state.swipeZonePointerId = 0;
    });
  }

  setSubtitleOffsetSeconds(0, { silent: true });
  init();
})();

