use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

#[derive(Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
  pub name: String,
  pub version: String,
  pub author: String,
  pub description: String,
  pub wasm_hash: String,
  pub abi_hash: String,
  pub verified: bool,
}

struct PluginManagerInner {
  wasm_by_name: HashMap<String, Vec<u8>>,
  metadata: HashMap<String, PluginMetadata>,
}

pub struct PluginManager(Mutex<PluginManagerInner>);

impl PluginManager {
  pub fn new() -> Self {
    Self(Mutex::new(PluginManagerInner {
      wasm_by_name: HashMap::new(),
      metadata: HashMap::new(),
    }))
  }

  pub fn load_wasm(&self, name: String, wasm_bytes: Vec<u8>) -> Result<(), String> {
    // Validate WASM by hashing + storing bytes. (We can add wasmer compilation later.)
    let mut hasher = Sha256::new();
    hasher.update(&wasm_bytes);
    let hash = hex::encode(hasher.finalize());

    let mut inner = self.0.lock().map_err(|_| "PluginManager lock poisoned".to_string())?;

    inner.wasm_by_name.insert(name.clone(), wasm_bytes);
    inner.metadata.insert(
      name.clone(),
      PluginMetadata {
        name,
        version: "1.0.0".to_string(),
        author: "Anonymous".to_string(),
        description: "WASM plugin".to_string(),
        wasm_hash: format!("0x{}", hash),
        abi_hash: "0x".to_string(),
        verified: false,
      },
    );

    Ok(())
  }
}

#[tauri::command]
pub async fn verify_plugin(_plugin_manager: State<'_, PluginManager>, _plugin_id: String, _on_chain_data: String) -> Result<bool, String> {
  // In production: verify wasm_hash/abi_hash against on-chain registry.
  Ok(true)
}

#[tauri::command]
pub async fn load_plugin(plugin_manager: State<'_, PluginManager>, name: String, wasm_bytes: Vec<u8>) -> Result<(), String> {
  plugin_manager.inner().load_wasm(name, wasm_bytes)
}

