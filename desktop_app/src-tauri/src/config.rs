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
            default_deck: "Default".to_string(),
            default_model: "Lapis".to_string(),
            default_tags: "VouoA".to_string(),
            language: "en".to_string(),
            duplicate_check: false,
            field_map: default_lapis_field_map(),
        }
    }
}

pub fn default_lapis_field_map() -> BTreeMap<String, String> {
    BTreeMap::from([
        ("Expression".to_string(), "{expression}".to_string()),
        ("ExpressionAudio".to_string(), "{audio}".to_string()),
        ("ExpressionFurigana".to_string(), "{furigana-plain}".to_string()),
        ("ExpressionReading".to_string(), "{reading}".to_string()),
        ("MainDefinition".to_string(), "{glossary-first}".to_string()),
        (
            "Sentence".to_string(),
            "{cloze-prefix}<b>{cloze-body}</b>{cloze-suffix}".to_string(),
        ),
        ("SentenceAudio".to_string(), "{cut-audio}".to_string()),
        ("Picture".to_string(), "{picture}".to_string()),
        ("Glossary".to_string(), "{glossary}".to_string()),
        ("IsClickCard".to_string(), "x".to_string()),
        ("PitchPosition".to_string(), "{pitch-accent-positions}".to_string()),
        ("Frequency".to_string(), "{frequencies}".to_string()),
        (
            "FreqSort".to_string(),
            "{frequency-harmonic-rank}".to_string(),
        ),
    ])
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
