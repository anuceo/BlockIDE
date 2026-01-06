use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkStatus {
  pub name: String,
  pub chain_id: u64,
  pub block_height: u64,
  pub gas_price: u64,
  pub connected: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WalletInfo {
  pub address: String,
  pub balance: String,
  pub network: String,
  pub connected: bool,
}

#[tauri::command]
pub async fn get_network_status(network: String) -> Result<NetworkStatus, String> {
  log::info!("Getting network status for: {}", network);

  let (chain_id, gas_price) = match network.as_str() {
    "ethereum" => (1, 30),
    "polygon" => (137, 50),
    "bsc" => (56, 3),
    _ => (1, 30),
  };

  Ok(NetworkStatus {
    name: network,
    chain_id,
    block_height: 17_890_000,
    gas_price,
    connected: true,
  })
}

#[tauri::command]
pub async fn check_wallet_connection() -> Result<WalletInfo, String> {
  Ok(WalletInfo {
    address: "0x742d35Cc6634C0532925a3b844Bc9e9997a425F8".to_string(),
    balance: "1.5 ETH".to_string(),
    network: "ethereum".to_string(),
    connected: true,
  })
}

#[tauri::command]
pub async fn save_file(path: String, content: String) -> Result<(), String> {
  if let Some(parent) = std::path::Path::new(&path).parent() {
    fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {e}"))?;
  }

  let mut file =
    fs::File::create(&path).map_err(|e| format!("Failed to create file {path}: {e}"))?;

  file
    .write_all(content.as_bytes())
    .map_err(|e| format!("Failed to write file {path}: {e}"))?;

  Ok(())
}

#[tauri::command]
pub async fn load_file(path: String) -> Result<String, String> {
  fs::read_to_string(&path).map_err(|e| format!("Failed to read file {path}: {e}"))
}

#[tauri::command]
pub async fn list_files(directory: String) -> Result<Vec<String>, String> {
  let entries =
    fs::read_dir(&directory).map_err(|e| format!("Failed to read directory {directory}: {e}"))?;

  let mut files = Vec::new();
  for entry in entries {
    match entry {
      Ok(entry) => {
        if let Ok(file_name) = entry.file_name().into_string() {
          files.push(file_name);
        }
      }
      Err(e) => log::warn!("Error reading directory entry: {}", e),
    }
  }

  Ok(files)
}

