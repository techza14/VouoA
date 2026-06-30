use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct BridgeConfig {
    pub default_deck: String,
    pub default_model: String,
    pub default_tags: String,
    pub language: String,
    pub duplicate_check: bool,
    pub field_map: BTreeMap<String, String>,
}

impl Default for BridgeConfig {
    fn default() -> Self {
        Self {
            default_deck: String::new(),
            default_model: String::new(),
            default_tags: "VouoA".to_string(),
            language: "en".to_string(),
            duplicate_check: false,
            field_map: BTreeMap::new(),
        }
    }
}

pub fn value_options() -> Vec<(String, String)> {
    vec![
        ("do not write".into(), "".into()),
        ("expression".into(), "{expression}".into()),
        ("furigana-plain".into(), "{furigana-plain}".into()),
        ("furigana".into(), "{furigana}".into()),
        ("reading".into(), "{reading}".into()),
        ("glossary-first".into(), "{glossary-first}".into()),
        ("glossary".into(), "{glossary}".into()),
        ("sentence".into(), "{sentence}".into()),
        ("cloze sentence".into(), "{cloze-sentence}".into()),
        ("audio".into(), "{audio}".into()),
        ("cut audio".into(), "{cut-audio}".into()),
        ("screenshot".into(), "{picture}".into()),
        ("frequencies".into(), "{frequencies}".into()),
        (
            "frequency-harmonic-rank".into(),
            "{frequency-harmonic-rank}".into(),
        ),
        (
            "pitch-accent-positions".into(),
            "{pitch-accent-positions}".into(),
        ),
        ("pitch-accents".into(), "{pitch-accents}".into()),
        ("page url".into(), "{url}".into()),
        ("x".into(), "x".into()),
    ]
}

pub fn load_or_default(path: &Path) -> Result<BridgeConfig, String> {
    if !path.exists() {
        return Ok(BridgeConfig::default());
    }
    let raw = fs::read_to_string(path).map_err(|error| format!("Failed to read config: {error}"))?;
    let normalized = raw.trim_start_matches('\u{feff}');
    serde_json::from_str::<BridgeConfig>(normalized).map_err(|error| format!("Failed to parse config: {error}"))
}

pub fn save(path: &Path, config: &BridgeConfig) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("Failed to create config directory: {error}"))?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|error| format!("Failed to serialize config: {error}"))?;
    fs::write(path, json).map_err(|error| format!("Failed to write config: {error}"))
}

pub fn normalize_path(path: PathBuf) -> String {
    path.to_string_lossy().to_string()
}
