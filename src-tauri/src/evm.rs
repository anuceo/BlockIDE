use ethers::prelude::*;
use ethers::types::transaction::eip2718::TypedTransaction;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeployedContract {
  pub address: String,
  pub bytecode: String,
  pub name: String,
  pub deployer: String,
  pub timestamp: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContractDeployment {
  pub address: String,
  pub bytecode: String,
  pub gas_used: u64,
  pub transaction_hash: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeploymentResult {
  pub address: String,
  pub tx_hash: String,
  pub gas_used: u64,
  pub block_number: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContractExecution {
  pub result: String,
  pub gas_used: u64,
  pub logs: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GasEstimation {
  pub slow: u64,
  pub standard: u64,
  pub fast: u64,
  pub max_fee_per_gas: u64,
  pub max_priority_fee_per_gas: u64,
}

#[tauri::command]
pub async fn deploy_contract(
  bytecode: String,
  rpc_url: String,
  private_key: String,
  chain_id: u64,
) -> Result<DeploymentResult, String> {
  let bytecode_clean = bytecode.strip_prefix("0x").unwrap_or(bytecode.as_str());
  let bytecode_bytes =
    hex::decode(bytecode_clean).map_err(|e| format!("Invalid bytecode: {e}"))?;

  let provider = Provider::<Http>::try_from(rpc_url.as_str())
    .map_err(|e| format!("Failed to connect to RPC: {e}"))?
    .interval(std::time::Duration::from_millis(50));

  let wallet: LocalWallet = private_key
    .parse::<LocalWallet>()
    .map_err(|e| format!("Invalid private key: {e}"))?
    .with_chain_id(chain_id);

  let client = SignerMiddleware::new(provider, wallet);
  let client = Arc::new(client);

  let tx: TypedTransaction = TransactionRequest::new()
    .data(Bytes::from(bytecode_bytes))
    .gas(3_000_000u64)
    .into();

  let pending_tx = client
    .send_transaction(tx, None)
    .await
    .map_err(|e| format!("Failed to send transaction: {e}"))?;

  let receipt = pending_tx
    .await
    .map_err(|e| format!("Transaction failed: {e}"))?
    .ok_or_else(|| "Transaction receipt not found".to_string())?;

  let contract_address = receipt
    .contract_address
    .ok_or_else(|| "No contract address in receipt".to_string())?;

  Ok(DeploymentResult {
    address: format!("{contract_address:?}"),
    tx_hash: format!("{:?}", receipt.transaction_hash),
    gas_used: receipt.gas_used.unwrap_or_default().as_u64(),
    block_number: receipt.block_number.unwrap_or_default().as_u64(),
  })
}

#[tauri::command]
pub async fn execute_contract(
  contract_address: String,
  calldata: String,
  value: Option<String>,
  gas_limit: Option<u64>,
) -> Result<ContractExecution, String> {
  log::info!(
    "Executing contract {} with calldata: {}",
    contract_address,
    calldata
  );
  if let Some(v) = value.as_deref() {
    log::info!("Call value provided (ignored in mock): {}", v);
  }

  // Mock execution: return "true" in ABI-encoded form
  Ok(ContractExecution {
    result:
      "0x0000000000000000000000000000000000000000000000000000000000000001".to_string(),
    gas_used: gas_limit.unwrap_or(50_000),
    logs: vec![],
  })
}

#[tauri::command]
pub async fn estimate_gas(
  bytecode: String,
  _calldata: Option<String>,
) -> Result<GasEstimation, String> {
  let base_gas = 21_000_u64;
  let contract_gas = bytecode.len() as u64 * 16;
  let total = base_gas + contract_gas;

  Ok(GasEstimation {
    slow: total * 80 / 100,
    standard: total,
    fast: total * 120 / 100,
    max_fee_per_gas: 30,
    max_priority_fee_per_gas: 2,
  })
}

