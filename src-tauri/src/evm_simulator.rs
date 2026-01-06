use revm::{database::InMemoryDB, ExecuteEvm, MainBuilder, MainContext};
use revm::context::TxEnv;
use revm::context_interface::result::{ExecutionResult, Output};
use revm::primitives::{Address, Bytes, TxKind, U256};
use serde::Serialize;

#[derive(Serialize)]
pub struct SimulationResult {
  pub success: bool,
  pub gas_used: u64,
  pub output: String,
  pub logs: Vec<String>,
  pub error: Option<String>,
}

fn decode_hex_allow_0x(s: &str) -> Result<Vec<u8>, String> {
  let s = s.strip_prefix("0x").unwrap_or(s);
  if s.is_empty() {
    return Ok(vec![]);
  }
  hex::decode(s).map_err(|e| format!("Invalid hex: {e}"))
}

fn parse_address(s: &str) -> Result<Address, String> {
  let bytes = decode_hex_allow_0x(s)?;
  if bytes.len() != 20 {
    return Err(format!("Invalid address length: expected 20 bytes, got {}", bytes.len()));
  }
  Ok(Address::from_slice(&bytes))
}

fn parse_u256_hex(s: &str) -> U256 {
  let s = s.strip_prefix("0x").unwrap_or(s);
  U256::from_str_radix(s, 16).unwrap_or_else(|_| U256::ZERO)
}

#[tauri::command]
pub async fn simulate_contract_execution(
  bytecode: String,
  data: String,
  value: String,
  caller: String,
  gas_limit: u64,
) -> Result<SimulationResult, String> {
  let ctx = revm::Context::mainnet().with_db(InMemoryDB::default());
  let mut evm = ctx.build_mainnet();

  let bytecode_bytes = decode_hex_allow_0x(&bytecode)?;
  let data_bytes = decode_hex_allow_0x(&data).unwrap_or_default();
  let value_u256 = parse_u256_hex(&value);
  let caller_addr = parse_address(&caller)?;

  // Deploy first
  let deploy_tx = TxEnv::builder()
    .caller(caller_addr)
    .gas_limit(gas_limit)
    .kind(TxKind::Create)
    .data(Bytes::from(bytecode_bytes.clone()))
    .value(value_u256)
    .build_fill();

  let deploy = evm
    .transact(deploy_tx)
    .map_err(|e| format!("Deployment failed: {e:?}"))?;

  let deployed_addr = match deploy.result {
    ExecutionResult::Success { output, gas_used, .. } => match output {
      Output::Create(_bytes, Some(addr)) => addr,
      Output::Create(_bytes, None) => {
        return Ok(SimulationResult {
          success: false,
          gas_used,
          output: String::new(),
          logs: vec![],
          error: Some("Deployment succeeded but no address returned".to_string()),
        })
      }
      _ => {
        return Ok(SimulationResult {
          success: false,
          gas_used,
          output: String::new(),
          logs: vec![],
          error: Some("Unexpected output type during deployment".to_string()),
        })
      }
    },
    ExecutionResult::Revert { gas_used, output } => {
      return Ok(SimulationResult {
        success: false,
        gas_used,
        output: format!("Revert: 0x{}", hex::encode(output)),
        logs: vec![],
        error: Some("Contract reverted during deployment".to_string()),
      })
    }
    ExecutionResult::Halt { reason, gas_used } => {
      return Ok(SimulationResult {
        success: false,
        gas_used,
        output: String::new(),
        logs: vec![],
        error: Some(format!("Execution halted during deployment: {reason:?}")),
      })
    }
  };

  // Call
  let call_tx = TxEnv::builder()
    .caller(caller_addr)
    .gas_limit(gas_limit)
    .kind(TxKind::Call(deployed_addr))
    .data(Bytes::from(data_bytes))
    .value(value_u256)
    .build_fill();

  let call = evm
    .transact(call_tx)
    .map_err(|e| format!("Execution failed: {e:?}"))?;

  match call.result {
    ExecutionResult::Success { output, logs, gas_used, .. } => {
      let out_bytes = match output {
        Output::Call(bytes) => bytes,
        _ => Bytes::default(),
      };
      let log_strings = logs.into_iter().map(|log| format!("{log:?}")).collect();

      Ok(SimulationResult {
        success: true,
        gas_used,
        output: format!("0x{}", hex::encode(out_bytes)),
        logs: log_strings,
        error: None,
      })
    }
    ExecutionResult::Revert { gas_used, output } => Ok(SimulationResult {
      success: false,
      gas_used,
      output: format!("Revert: 0x{}", hex::encode(output)),
      logs: vec![],
      error: Some("Contract reverted".to_string()),
    }),
    ExecutionResult::Halt { reason, gas_used } => Ok(SimulationResult {
      success: false,
      gas_used,
      output: String::new(),
      logs: vec![],
      error: Some(format!("Execution halted: {reason:?}")),
    }),
  }
}

