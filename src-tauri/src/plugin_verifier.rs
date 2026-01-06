use serde::{Deserialize, Serialize};

#[derive(Default)]
pub struct PluginManager {}

impl PluginManager {
    pub fn new() -> Self {
        Self::default()
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PluginVerificationResult {
    pub ok: bool,
    pub message: String,
    pub sha256: Option<String>,
}

#[tauri::command]
pub async fn verify_plugin(_plugin_bytes: Vec<u8>) -> Result<PluginVerificationResult, String> {
    // Stub: real implementation would hash + verify signatures/manifests.
    Ok(PluginVerificationResult {
        ok: true,
        message: "Plugin verification stubbed".to_string(),
        sha256: None,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoadedPlugin {
    pub id: String,
    pub name: String,
    pub version: String,
}

#[tauri::command]
pub async fn load_plugin(_plugin_bytes: Vec<u8>) -> Result<LoadedPlugin, String> {
    Ok(LoadedPlugin {
        id: "plugin-stub".to_string(),
        name: "Stub Plugin".to_string(),
        version: "0.0.0".to_string(),
    })
}

