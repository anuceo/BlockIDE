use reqwest::Client;
use serde_json::Value;
use tauri::State;

pub struct IPFSClient {
  client: Client,
  endpoint: String,
}

impl IPFSClient {
  pub fn new(endpoint: &str) -> Self {
    Self {
      client: Client::new(),
      endpoint: endpoint.to_string(),
    }
  }

  pub async fn add(&self, data: &[u8]) -> Result<String, String> {
    let url = format!("{}/api/v0/add", self.endpoint);

    // NOTE: This is a minimal stub that posts raw bytes; many IPFS nodes
    // expect multipart/form-data. We'll improve this when IPFS integration
    // is exercised end-to-end.
    let response = self
      .client
      .post(&url)
      .body(data.to_vec())
      .send()
      .await
      .map_err(|e| e.to_string())?;

    let json: Value = response.json().await.map_err(|e| e.to_string())?;
    json
      .get("Hash")
      .and_then(|h| h.as_str())
      .map(|s| s.to_string())
      .ok_or_else(|| "No hash in response".to_string())
  }

  pub async fn pin(&self, cid: &str) -> Result<(), String> {
    let url = format!("{}/api/v0/pin/add?arg={}", self.endpoint, cid);
    self
      .client
      .post(&url)
      .send()
      .await
      .map_err(|e| e.to_string())?;
    Ok(())
  }
}

#[tauri::command]
pub async fn upload_to_ipfs(ipfs_client: State<'_, IPFSClient>, data: Vec<u8>) -> Result<String, String> {
  ipfs_client.inner().add(&data).await
}

#[tauri::command]
pub async fn pin_json(ipfs_client: State<'_, IPFSClient>, json_data: String) -> Result<String, String> {
  let cid = ipfs_client.inner().add(json_data.as_bytes()).await?;
  ipfs_client.inner().pin(&cid).await?;
  Ok(cid)
}

