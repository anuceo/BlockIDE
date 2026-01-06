use serde::{Deserialize, Serialize};

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
  _value: Option<String>,
  gas_limit: Option<u64>,
) -> Result<ContractDeployment, String> {
  log::info!("Deploying contract with bytecode length: {}", bytecode.len());

  // Generate mock contract address
  let address = format!("0x{}", hex::encode(rand::random::<[u8; 20]>()))
    .to_lowercase();

  Ok(ContractDeployment {
    address,
    bytecode,
    gas_used: gas_limit.unwrap_or(1_000_000),
    transaction_hash: format!("0x{}", hex::encode(rand::random::<[u8; 32]>())).to_lowercase(),
  })
}

#[tauri::command]
pub async fn execute_contract(
  contract_address: String,
  calldata: String,
  _value: Option<String>,
  gas_limit: Option<u64>,
) -> Result<ContractExecution, String> {
  log::info!(
    "Executing contract {} with calldata: {}",
    contract_address,
    calldata
  );

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

