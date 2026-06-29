use std::{
    collections::VecDeque,
    fs,
    io::{BufRead, BufReader},
    io::Write,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};

use reqwest::blocking::Client;
use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::config::{self, BridgeConfig};

const BRIDGE_PORT: u16 = 5051;
const BRIDGE_HOST: &str = "0.0.0.0";
const BRIDGE_LOCAL_URL: &str = "http://127.0.0.1:5051";
const PROBE_SUCCESS_TTL: Duration = Duration::from_secs(2);
const PROBE_FAILURE_TTL: Duration = Duration::from_secs(8);
const BRIDGE_PROBE_TIMEOUT: Duration = Duration::from_millis(800);
const ANKI_PROBE_TIMEOUT: Duration = Duration::from_millis(800);
const YOMITAN_PROBE_TIMEOUT: Duration = Duration::from_secs(1);

#[derive(Debug, Clone, Serialize)]
pub struct ProbeState {
    pub ok: bool,
    pub code: String,
    pub label: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BridgeStatusSnapshot {
    pub running: bool,
    pub pid: Option<u32>,
    pub bind_host: String,
    pub bind_port: u16,
    pub bridge: ProbeState,
    pub anki_connect: ProbeState,
    pub yomitan_api: ProbeState,
    pub config_path: String,
    pub launch_target: String,
    pub last_import_error: String,
    pub last_import_audio_status: String,
    pub last_import_audio_detail: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppSnapshot {
    pub config: BridgeConfig,
    pub value_options: Vec<(String, String)>,
    pub recent_logs: Vec<String>,
    pub status: BridgeStatusSnapshot,
}

#[derive(Debug, Clone)]
pub struct SharedState {
    pub inner: Arc<Mutex<RuntimeState>>,
}

#[derive(Debug)]
pub struct RuntimeState {
    pub child: Option<Child>,
    pub logs: VecDeque<String>,
    pub probe_cache: ProbeCache,
}

#[derive(Debug, Clone)]
pub struct CachedProbeState {
    pub probe: ProbeState,
    pub checked_at: Instant,
}

#[derive(Debug, Clone, Default)]
pub struct ProbeCache {
    pub bridge: Option<CachedProbeState>,
    pub anki_connect: Option<CachedProbeState>,
    pub yomitan_api: Option<CachedProbeState>,
}

#[derive(Debug, Clone)]
pub struct BridgeLaunchSpec {
    pub label: String,
    pub program: PathBuf,
    pub args: Vec<String>,
    pub working_dir: PathBuf,
    pub config_path: PathBuf,
    pub log_path: PathBuf,
}

impl Default for SharedState {
    fn default() -> Self {
        Self {
            inner: Arc::new(Mutex::new(RuntimeState {
                child: None,
                logs: VecDeque::new(),
                probe_cache: ProbeCache::default(),
            })),
        }
    }
}

pub fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .unwrap_or_else(|| Path::new("."))
        .to_path_buf()
}

fn debug_log_path() -> Option<PathBuf> {
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    Some(exe_dir.join("vouoa_desktop.log"))
}

fn write_debug_log(message: impl AsRef<str>) {
    let Some(path) = debug_log_path() else {
        return;
    };
    let line = format!("{}\r\n", message.as_ref());
    if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = file.write_all(line.as_bytes());
    }
}

fn push_log(state: &SharedState, message: impl Into<String>) {
    let message = message.into();
    write_debug_log(&message);
    let mut guard = state.inner.lock().expect("shared state poisoned");
    guard.logs.push_front(message);
    while guard.logs.len() > 8 {
        guard.logs.pop_back();
    }
}

fn invalidate_probe_cache(state: &SharedState) {
    let mut guard = state.inner.lock().expect("shared state poisoned");
    guard.probe_cache = ProbeCache::default();
}

fn read_log_tail(path: &Path, max_lines: usize) -> Vec<String> {
    let Ok(contents) = fs::read_to_string(path) else {
        return Vec::new();
    };
    let mut lines = contents
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    if lines.len() > max_lines {
        lines = lines.split_off(lines.len() - max_lines);
    }
    lines.reverse();
    lines
}

fn bridge_http_client(timeout: Duration) -> Result<Client, String> {
    Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {error}"))
}

fn latest_bridge_bundle(repo_root: &Path) -> Option<PathBuf> {
    let out_dir = repo_root.join("out");
    let mut candidates: Vec<(std::time::SystemTime, PathBuf)> = Vec::new();
    let entries = fs::read_dir(out_dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.starts_with("anki_bridge_") {
            continue;
        }
        let exe_path = path.join("anki_bridge_server.exe");
        if !exe_path.exists() {
            continue;
        }
        let modified = entry
            .metadata()
            .and_then(|meta| meta.modified())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
        candidates.push((modified, exe_path));
    }
    candidates.sort_by(|left, right| right.0.cmp(&left.0));
    candidates.into_iter().next().map(|item| item.1)
}

fn portable_bridge_spec(exe_dir: &Path) -> Option<BridgeLaunchSpec> {
    let bridge_dir = exe_dir.join("bridge");
    let exe_path = bridge_dir.join("anki_bridge_server.exe");
    if !exe_path.exists() {
        return None;
    }

    Some(BridgeLaunchSpec {
        label: "portable bridge".to_string(),
        program: exe_path,
        args: vec![
            "--host".into(),
            BRIDGE_HOST.into(),
            "--port".into(),
            BRIDGE_PORT.to_string(),
        ],
        working_dir: bridge_dir.clone(),
        config_path: bridge_dir.join("anki_bridge_config.json"),
        log_path: bridge_dir.join("anki_bridge.log"),
    })
}

fn resolve_bridge_launch(app: &AppHandle) -> Result<BridgeLaunchSpec, String> {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            if let Some(spec) = portable_bridge_spec(exe_dir) {
                return Ok(spec);
            }
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        if let Some(spec) = portable_bridge_spec(&resource_dir) {
            return Ok(spec);
        }

        let bridge_dir = resource_dir.join("bridge");
        let exe_path = bridge_dir.join("anki_bridge_server.exe");
        if exe_path.exists() {
            return Ok(BridgeLaunchSpec {
                label: "packaged bridge".to_string(),
                program: exe_path,
                args: vec![
                    "--host".into(),
                    BRIDGE_HOST.into(),
                    "--port".into(),
                    BRIDGE_PORT.to_string(),
                ],
                working_dir: bridge_dir.clone(),
                config_path: bridge_dir.join("anki_bridge_config.json"),
                log_path: bridge_dir.join("anki_bridge.log"),
            });
        }
    }

    let root = repo_root();
    if let Some(exe_path) = latest_bridge_bundle(&root) {
        let bridge_dir = exe_path.parent().unwrap_or(&root).to_path_buf();
        return Ok(BridgeLaunchSpec {
            label: "out bundle bridge".to_string(),
            program: exe_path,
            args: vec![
                "--host".into(),
                BRIDGE_HOST.into(),
                "--port".into(),
                BRIDGE_PORT.to_string(),
            ],
            working_dir: bridge_dir.clone(),
            config_path: bridge_dir.join("anki_bridge_config.json"),
            log_path: bridge_dir.join("anki_bridge.log"),
        });
    }

    let dist_exe = root.join("dist").join("anki_bridge_server.exe");
    if dist_exe.exists() {
        let bridge_dir = dist_exe.parent().unwrap_or(&root).to_path_buf();
        return Ok(BridgeLaunchSpec {
            label: "dist bridge".to_string(),
            program: dist_exe,
            args: vec![
                "--host".into(),
                BRIDGE_HOST.into(),
                "--port".into(),
                BRIDGE_PORT.to_string(),
            ],
            working_dir: bridge_dir.clone(),
            config_path: bridge_dir.join("anki_bridge_config.json"),
            log_path: bridge_dir.join("anki_bridge.log"),
        });
    }

    let tools_dir = root.join("tools");
    let bridge_script = tools_dir.join("anki_bridge_server.py");
    if !bridge_script.exists() {
        return Err("Could not find a bridge executable or script.".to_string());
    }

    let venv_python = root.join(".venv313").join("Scripts").join("python.exe");
    let python_program = if venv_python.exists() {
        venv_python
    } else {
        PathBuf::from("python")
    };

    Ok(BridgeLaunchSpec {
        label: "python bridge".to_string(),
        program: python_program,
        args: vec![
            bridge_script.to_string_lossy().to_string(),
            "--host".into(),
            BRIDGE_HOST.into(),
            "--port".into(),
            BRIDGE_PORT.to_string(),
        ],
        working_dir: tools_dir.clone(),
        config_path: tools_dir.join("anki_bridge_config.json"),
        log_path: tools_dir.join("anki_bridge.log"),
    })
}

fn ensure_default_config(spec: &BridgeLaunchSpec) -> Result<BridgeConfig, String> {
    let config = config::load_or_default(&spec.config_path)?;
    config::save(&spec.config_path, &config)?;
    Ok(config)
}

fn spawn_log_thread<R: std::io::Read + Send + 'static>(state: SharedState, reader: R, prefix: &'static str) {
    thread::spawn(move || {
        for line in BufReader::new(reader).lines().map_while(Result::ok) {
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                push_log(&state, format!("{prefix}: {trimmed}"));
            }
        }
    });
}

fn is_child_running(state: &SharedState) -> (bool, Option<u32>) {
    let mut guard = state.inner.lock().expect("shared state poisoned");
    if let Some(child) = guard.child.as_mut() {
        match child.try_wait() {
            Ok(Some(status)) => {
                let pid = child.id();
                guard.child = None;
                guard.logs.push_front(format!("bridge exited: pid={} status={status}", pid));
                while guard.logs.len() > 8 {
                    guard.logs.pop_back();
                }
                (false, None)
            }
            Ok(None) => (true, Some(child.id())),
            Err(error) => {
                guard.logs.push_front(format!("bridge state check failed: {error}"));
                while guard.logs.len() > 8 {
                    guard.logs.pop_back();
                }
                (false, None)
            }
        }
    } else {
        (false, None)
    }
}

pub fn start_bridge(app: &AppHandle, state: &SharedState) -> Result<(), String> {
    let (running, _) = is_child_running(state);
    if running {
        write_debug_log("start_bridge: managed child already running");
        return Ok(());
    }
    if probe_bridge_health().ok {
        invalidate_probe_cache(state);
        push_log(state, "bridge already online, skipped spawning a duplicate process");
        return Ok(());
    }

    let spec = resolve_bridge_launch(app).inspect_err(|error| {
        write_debug_log(format!("start_bridge: resolve failed: {error}"));
    })?;
    write_debug_log(format!(
        "start_bridge: launching '{}' from {}",
        spec.label,
        spec.program.display()
    ));
    let _config = ensure_default_config(&spec).inspect_err(|error| {
        write_debug_log(format!("start_bridge: config failed: {error}"));
    })?;

    let mut command = Command::new(&spec.program);
    let _ = fs::remove_file(&spec.log_path);
    let mut args = spec.args.clone();
    args.push("--log-file".into());
    args.push(spec.log_path.to_string_lossy().to_string());
    command
        .args(&args)
        .current_dir(&spec.working_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command
        .spawn()
        .map_err(|error| {
            write_debug_log(format!("start_bridge: spawn failed: {error}"));
            format!("Failed to start bridge: {error}")
        })?;

    let pid = child.id();
    push_log(state, format!("bridge started: {} (pid={pid})", spec.label));

    if let Some(stdout) = child.stdout.take() {
        spawn_log_thread(state.clone(), stdout, "stdout");
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_log_thread(state.clone(), stderr, "stderr");
    }

    let mut guard = state.inner.lock().expect("shared state poisoned");
    guard.child = Some(child);
    guard.probe_cache = ProbeCache::default();
    Ok(())
}

pub fn stop_bridge(state: &SharedState) -> Result<(), String> {
    let mut guard = state.inner.lock().expect("shared state poisoned");
    if let Some(mut child) = guard.child.take() {
        let pid = child.id();
        child.kill().map_err(|error| format!("Failed to stop bridge: {error}"))?;
        let _ = child.wait();
        guard.logs.push_front(format!("bridge stopped: pid={pid}"));
        while guard.logs.len() > 8 {
            guard.logs.pop_back();
        }
    }
    guard.probe_cache = ProbeCache::default();
    Ok(())
}

pub fn restart_bridge(app: &AppHandle, state: &SharedState) -> Result<(), String> {
    stop_bridge(state)?;
    start_bridge(app, state)
}

pub fn load_config(app: &AppHandle) -> Result<(BridgeLaunchSpec, BridgeConfig), String> {
    let spec = resolve_bridge_launch(app)?;
    let config = ensure_default_config(&spec)?;
    Ok((spec, config))
}

pub fn save_config(app: &AppHandle, next_config: &BridgeConfig) -> Result<BridgeConfig, String> {
    let spec = resolve_bridge_launch(app)?;
    config::save(&spec.config_path, next_config)?;
    config::load_or_default(&spec.config_path)
}

fn fetch_json_ok(url: &str, timeout: Duration) -> Result<serde_json::Value, String> {
    let response = bridge_http_client(timeout)?
        .get(url)
        .send()
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }
    response.json::<serde_json::Value>().map_err(|error| error.to_string())
}

fn probe_bridge_health() -> ProbeState {
    match fetch_json_ok(&format!("{BRIDGE_LOCAL_URL}/health"), BRIDGE_PROBE_TIMEOUT) {
        Ok(_) => ProbeState {
            ok: true,
            code: "connected".into(),
            label: "Bridge Online".into(),
            detail: "Local bridge is responding to /health".into(),
        },
        Err(error) => ProbeState {
            ok: false,
            code: "disconnected".into(),
            label: "Bridge Offline".into(),
            detail: error,
        },
    }
}

fn probe_anki_connect() -> ProbeState {
    match fetch_json_ok(&format!("{BRIDGE_LOCAL_URL}/anki/decks"), ANKI_PROBE_TIMEOUT) {
        Ok(value) => {
            let decks = value
                .get("decks")
                .and_then(|item| item.as_array())
                .map(|items| items.len())
                .unwrap_or(0);
            ProbeState {
                ok: true,
                code: "connected".into(),
                label: "AnkiConnect Connected".into(),
                detail: format!("Detected {decks} decks"),
            }
        }
        Err(error) => ProbeState {
            ok: false,
            code: "disconnected".into(),
            label: "AnkiConnect Disconnected".into(),
            detail: error,
        },
    }
}

fn probe_yomitan_api() -> ProbeState {
    let server = match fetch_json_ok(&format!("{BRIDGE_LOCAL_URL}/yomitan/serverVersion"), YOMITAN_PROBE_TIMEOUT) {
        Ok(value) => value,
        Err(error) => {
            return ProbeState {
                ok: false,
                code: "disconnected".into(),
                label: "Yomitan API Disconnected".into(),
                detail: error,
            }
        }
    };

    match fetch_json_ok(&format!("{BRIDGE_LOCAL_URL}/yomitan/yomitanVersion"), YOMITAN_PROBE_TIMEOUT) {
        Ok(yomitan) => ProbeState {
            ok: true,
            code: "connected".into(),
            label: "Yomitan API Connected".into(),
            detail: format!(
                "Server version: {}; Yomitan version: {}",
                server
                    .get("result")
                    .map(|item| item.to_string())
                    .unwrap_or_else(|| "responded".into()),
                yomitan
                    .get("result")
                    .map(|item| item.to_string())
                    .unwrap_or_else(|| "responded".into())
            ),
        },
        Err(error) => ProbeState {
            ok: false,
            code: "disconnected".into(),
            label: "Yomitan API Disconnected".into(),
            detail: error,
        },
    }
}

fn cached_probe<F>(
    state: &SharedState,
    select: impl Fn(&ProbeCache) -> &Option<CachedProbeState>,
    update: impl Fn(&mut ProbeCache) -> &mut Option<CachedProbeState>,
    probe_fn: F,
) -> ProbeState
where
    F: FnOnce() -> ProbeState,
{
    {
        let guard = state.inner.lock().expect("shared state poisoned");
        if let Some(cached) = select(&guard.probe_cache) {
            let ttl = if cached.probe.ok {
                PROBE_SUCCESS_TTL
            } else {
                PROBE_FAILURE_TTL
            };
            if cached.checked_at.elapsed() < ttl {
                return cached.probe.clone();
            }
        }
    }

    let probe = probe_fn();
    let mut guard = state.inner.lock().expect("shared state poisoned");
    *update(&mut guard.probe_cache) = Some(CachedProbeState {
        probe: probe.clone(),
        checked_at: Instant::now(),
    });
    probe
}

pub fn get_snapshot(app: &AppHandle, state: &SharedState) -> Result<AppSnapshot, String> {
    let (spec, config) = load_config(app)?;
    let (child_running, pid) = is_child_running(state);
    let bridge = cached_probe(state, |cache| &cache.bridge, |cache| &mut cache.bridge, probe_bridge_health);
    let running = child_running || bridge.ok;
    let anki_connect = if bridge.ok {
        cached_probe(
            state,
            |cache| &cache.anki_connect,
            |cache| &mut cache.anki_connect,
            probe_anki_connect,
        )
    } else {
        ProbeState {
            ok: false,
            code: "unchecked".into(),
            label: "AnkiConnect Not Checked".into(),
            detail: "Bridge is not running".into(),
        }
    };
    let yomitan_api = if bridge.ok {
        cached_probe(
            state,
            |cache| &cache.yomitan_api,
            |cache| &mut cache.yomitan_api,
            probe_yomitan_api,
        )
    } else {
        ProbeState {
            ok: false,
            code: "unchecked".into(),
            label: "Yomitan API Not Checked".into(),
            detail: "Bridge is not running".into(),
        }
    };

    let mut recent_logs = {
        let guard = state.inner.lock().expect("shared state poisoned");
        guard.logs.iter().cloned().collect::<Vec<_>>()
    };
    let file_logs = read_log_tail(&spec.log_path, 24);
    if !file_logs.is_empty() {
        recent_logs = file_logs;
    }
    let last_import_error = recent_logs
        .iter()
        .find(|line| line.contains("IMPORT failed"))
        .cloned()
        .unwrap_or_default();
    let mut last_import_audio_status = String::new();
    let mut last_import_audio_detail = String::new();
    if let Some(import_ok_line) = recent_logs.iter().find(|line| line.contains("IMPORT ok")) {
        let audio_stored = import_ok_line.contains("audioStored=True");
        last_import_audio_status = if audio_stored {
            "Stored".into()
        } else {
            "Not stored".into()
        };
        if let Some(start) = import_ok_line.find("audioDiagnostic=") {
            let json_text = &import_ok_line[start + "audioDiagnostic=".len()..];
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(json_text) {
                if let Some(stored) = value.get("stored").and_then(|item| item.as_bool()) {
                    last_import_audio_status = if stored { "Stored".into() } else { "Not stored".into() };
                }
                if let Some(summary) = value.get("summary").and_then(|item| item.as_str()) {
                    last_import_audio_detail = summary.trim().to_string();
                }
            }
        }
        if last_import_audio_detail.is_empty() {
            if let Some(start) = import_ok_line.find("audioClipError='") {
                let rest = &import_ok_line[start + "audioClipError='".len()..];
                if let Some(end) = rest.find('\'') {
                    last_import_audio_detail = rest[..end].trim().to_string();
                }
            }
        }
        if !audio_stored && last_import_audio_detail.is_empty() {
            last_import_audio_detail = "No audio available for this import.".into();
        }
    }

    Ok(AppSnapshot {
        config,
        value_options: config::value_options(),
        recent_logs,
        status: BridgeStatusSnapshot {
            running,
            pid,
            bind_host: BRIDGE_HOST.into(),
            bind_port: BRIDGE_PORT,
            bridge,
            anki_connect,
            yomitan_api,
            config_path: config::normalize_path(spec.config_path),
            launch_target: spec.label,
            last_import_error,
            last_import_audio_status,
            last_import_audio_detail,
        },
    })
}

pub fn fetch_decks() -> Result<Vec<String>, String> {
    let value = fetch_json_ok(&format!("{BRIDGE_LOCAL_URL}/anki/decks"), Duration::from_secs(2))?;
    Ok(value
        .get("decks")
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(|text| text.to_string()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default())
}

pub fn fetch_models() -> Result<Vec<String>, String> {
    let value = fetch_json_ok(&format!("{BRIDGE_LOCAL_URL}/anki/models"), Duration::from_secs(2))?;
    Ok(value
        .get("models")
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(|text| text.to_string()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default())
}

pub fn fetch_model_fields(model: &str) -> Result<Vec<String>, String> {
    let encoded_model = urlencoding::encode(model);
    let value = fetch_json_ok(&format!(
        "{BRIDGE_LOCAL_URL}/anki/model-fields?model={encoded_model}"
    ), Duration::from_secs(2))?;
    Ok(value
        .get("fields")
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(|text| text.to_string()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default())
}
