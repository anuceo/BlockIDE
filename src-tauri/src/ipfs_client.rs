use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub struct IPFSClient {
    endpoint: String,
}

impl IPFSClient {
    pub fn new(endpoint: &str) -> Self {
        Self {
            endpoint: endpoint.to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IpfsUploadResult {
    pub cid: String,
    pub url: String,
}

#[tauri::command]
pub async fn upload_to_ipfs(_data: Vec<u8>) -> Result<IpfsUploadResult, String> {
    // Stub: real implementation would POST to IPFS API.
    Ok(IpfsUploadResult {
        cid: "bafybeigdyrztstub".to_string(),
        url: "ipfs://bafybeigdyrztstub".to_string(),
    })
}

#[tauri::command]
pub async fn pin_json(_json: serde_json::Value) -> Result<IpfsUploadResult, String> {
    Ok(IpfsUploadResult {
        cid: "bafybeigdyrztstubjson".to_string(),
        url: "ipfs://bafybeigdyrztstubjson".to_string(),
    })
}

