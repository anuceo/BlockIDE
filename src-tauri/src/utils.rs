use serde::{Deserialize, Serialize};

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
  Ok(NetworkStatus {
    chain_id: match network.as_str() {
      "ethereum" => 1,
      "polygon" => 137,
      "bsc" => 56,
      _ => 1,
    },
    name: network,
    block_height: 17_890_000,
    gas_price: 30,
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

