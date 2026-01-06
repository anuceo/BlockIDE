use serde::{Deserialize, Serialize};

#[derive(Default)]
pub struct EVMState {}

impl EVMState {
    pub fn new() -> Self {
        Self {}
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeployRequest {
    pub bytecode: String,
    pub abi: Option<serde_json::Value>,
    pub rpc_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeployResponse {
    pub address: String,
    pub tx_hash: String,
}

#[tauri::command]
pub async fn deploy_contract(_req: DeployRequest) -> Result<DeployResponse, String> {
    // Stub: real implementation would use web3 + a signer.
    Ok(DeployResponse {
        address: "0x0000000000000000000000000000000000000000".to_string(),
        tx_hash: "0x".to_string(),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecuteRequest {
    pub to: String,
    pub data: String,
    pub value: Option<String>,
    pub rpc_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecuteResponse {
    pub tx_hash: String,
    pub status: String,
}

#[tauri::command]
pub async fn execute_contract(_req: ExecuteRequest) -> Result<ExecuteResponse, String> {
    Ok(ExecuteResponse {
        tx_hash: "0x".to_string(),
        status: "stubbed".to_string(),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GasEstimateRequest {
    pub to: String,
    pub data: Option<String>,
    pub value: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GasEstimateResponse {
    pub gas: u64,
}

#[tauri::command]
pub async fn estimate_gas(_req: GasEstimateRequest) -> Result<GasEstimateResponse, String> {
    Ok(GasEstimateResponse { gas: 21_000 })
}

