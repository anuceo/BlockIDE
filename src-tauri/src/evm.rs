use serde::{Deserialize, Serialize};
use sha2::Digest;
use std::sync::Mutex;
use tauri::State;

// NOTE: This module is wired for Tauri commands and ships a minimal embedded-EVM
// surface. We keep the revm dependency in place, but start with lightweight,
// deterministic behavior for MVP bootstrapping.

#[derive(Default)]
pub struct EVMState {
  // Placeholder for a future persistent DB/cache. Keeping this as Mutex so we
  // can evolve to a shared revm CacheDB without changing command signatures.
  _inner: Mutex<()>,
}

impl EVMState {
  pub fn new() -> Self {
    Self { _inner: Mutex::new(()) }
  }
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

fn normalize_hex(input: &str) -> Result<Vec<u8>, String> {
  let s = input.trim();
  let s = s.strip_prefix("0x").unwrap_or(s);
  if s.is_empty() {
    return Ok(vec![]);
  }
  hex::decode(s).map_err(|e| format!("Invalid hex: {e}"))
}

#[tauri::command]
pub async fn deploy_contract(
  _evm_state: State<'_, EVMState>,
  bytecode: String,
  _value: Option<String>,
  _gas_limit: Option<u64>,
) -> Result<ContractDeployment, String> {
  let bytecode_bytes = normalize_hex(&bytecode)?;

  // Deterministic "address" and "tx hash" for now (hash of bytecode).
  let digest = sha2::Sha256::digest(&bytecode_bytes);
  let address = format!("0x{}", hex::encode(&digest[0..20]));
  let tx_hash = format!("0x{}", hex::encode(&digest));

  let gas_used = 21_000 + (bytecode_bytes.len() as u64 * 200);

  Ok(ContractDeployment {
    address,
    bytecode: format!("0x{}", hex::encode(bytecode_bytes)),
    gas_used,
    transaction_hash: tx_hash,
  })
}

#[tauri::command]
pub async fn execute_contract(
  _evm_state: State<'_, EVMState>,
  contract_address: String,
  calldata: String,
  _value: Option<String>,
  _gas_limit: Option<u64>,
) -> Result<ContractExecution, String> {
  let _addr = normalize_hex(&contract_address)?;
  let data = normalize_hex(&calldata)?;

  // Deterministic "result" is sha256(calldata)
  let digest = sha2::Sha256::digest(&data);

  Ok(ContractExecution {
    result: format!("0x{}", hex::encode(digest)),
    gas_used: 21_000 + (data.len() as u64 * 16),
    logs: vec![],
  })
}

#[tauri::command]
pub async fn estimate_gas(bytecode: String, calldata: Option<String>) -> Result<GasEstimation, String> {
  let bytecode = normalize_hex(&bytecode)?;
  let calldata = match calldata {
    Some(c) => normalize_hex(&c)?,
    None => vec![],
  };

  let base_gas = 21_000_u64;
  let deploy_component = bytecode.len() as u64 * 200;
  let call_component = calldata.len() as u64 * 16;
  let total = base_gas + deploy_component + call_component;

  Ok(GasEstimation {
    slow: total * 80 / 100,
    standard: total,
    fast: total * 120 / 100,
    max_fee_per_gas: 30,
    max_priority_fee_per_gas: 2,
  })
}

#[tauri::command]
pub async fn compile_solidity(source: String) -> Result<serde_json::Value, String> {
  // MVP stub: return deterministic mock output keyed by source hash.
  let digest = sha2::Sha256::digest(source.as_bytes());
  Ok(serde_json::json!({
    "bytecode": format!("0x{}", hex::encode(digest)),
    "abi": [],
    "contractName": "MockContract",
    "compilerVersion": "0.8.19",
    "optimizer": {
      "enabled": true,
      "runs": 200
    }
  }))
}

