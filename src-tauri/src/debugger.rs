use revm::{
  bytecode::OpCode,
  context::TxEnv,
  context_interface::result::{ExecutionResult, Output},
  context_interface::{ContextTr, JournalTr},
  database::InMemoryDB,
  interpreter::{
    interpreter_types::{InputsTr, MemoryTr, StackTr},
    interpreter_types::Jumps,
    CallInputs, CallOutcome, CreateInputs, CreateOutcome, Interpreter, InterpreterTypes,
  },
  primitives::{Address, Bytes, TxKind, U256},
  InspectEvm, Inspector, MainBuilder, MainContext,
};
use serde::{Deserialize, Serialize};
use std::{
  collections::HashMap,
  ops::Deref,
  sync::{Arc, Mutex},
};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugStep {
  pub pc: u64,
  pub opcode: String,
  pub gas: u64,
  pub gas_cost: u64,
  pub depth: usize,
  pub stack: Vec<String>,
  pub memory: Vec<String>,
  pub storage: HashMap<String, String>,
  pub contract_address: String,
  pub caller: String,
  pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Breakpoint {
  pub line: u32,
  pub enabled: bool,
  pub condition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugSession {
  pub session_id: String,
  pub bytecode: String,
  pub deployed_address: String,
  pub breakpoints: Vec<Breakpoint>,
  pub current_step: Option<DebugStep>,
  pub steps: Vec<DebugStep>,
  pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugResult {
  pub session_id: String,
  pub steps: Vec<DebugStep>,
  pub final_output: String,
  pub gas_used: u64,
  pub success: bool,
  pub error: Option<String>,
}

#[derive(Default)]
pub struct DebuggerManager {
  sessions: Mutex<HashMap<String, SessionInternal>>,
}

#[derive(Clone)]
struct SessionInternal {
  bytecode: String,
  deployed_address: String,
  trace: Vec<DebugStep>,
  cursor: usize,
  breakpoints: Vec<Breakpoint>,
  completed: bool,
  final_output: String,
  gas_used: u64,
  success: bool,
  error: Option<String>,
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
    return Err(format!(
      "Invalid address length: expected 20 bytes, got {}",
      bytes.len()
    ));
  }
  Ok(Address::from_slice(&bytes))
}

fn parse_u256_hex(s: &str) -> U256 {
  let s = s.strip_prefix("0x").unwrap_or(s);
  U256::from_str_radix(s, 16).unwrap_or_else(|_| U256::ZERO)
}

fn format_address(a: Address) -> String {
  format!("0x{}", hex::encode(a.as_slice()))
}

fn format_u256(v: U256) -> String {
  format!("0x{v:x}")
}

#[derive(Default)]
struct TraceState {
  steps: Vec<DebugStep>,
  pre_gas_remaining: u64,
}

#[derive(Clone)]
struct DebugInspector {
  shared: Arc<Mutex<TraceState>>,
}

impl DebugInspector {
  fn new(shared: Arc<Mutex<TraceState>>) -> Self {
    Self { shared }
  }
}

impl<CTX, INTR> Inspector<CTX, INTR> for DebugInspector
where
  CTX: ContextTr,
  INTR: InterpreterTypes<Stack: StackTr, Memory: MemoryTr>,
{
  fn step(&mut self, interp: &mut Interpreter<INTR>, context: &mut CTX) {
    let mut st = self.shared.lock().expect("trace mutex poisoned");
    st.pre_gas_remaining = interp.gas.remaining();

    let opcode = interp.bytecode.opcode();
    let stack = interp
      .stack
      .data()
      .iter()
      .rev()
      .map(|v| format!("0x{v:x}"))
      .collect::<Vec<_>>();

    let mem_size = interp.memory.size();
    let mem_bytes = interp.memory.slice(0..mem_size);
    let memory = mem_bytes
      .deref()
      .chunks(32)
      .take(64)
      .map(|chunk| format!("0x{}", hex::encode(chunk)))
      .collect::<Vec<_>>();

    let step = DebugStep {
      pc: interp.bytecode.pc() as u64,
      opcode: OpCode::new(opcode)
        .map(|op| op.as_str().to_string())
        .unwrap_or_else(|| format!("UNKNOWN(0x{opcode:02X})")),
      gas: st.pre_gas_remaining,
      gas_cost: 0,
      depth: context.journal_mut().depth(),
      stack,
      memory,
      storage: HashMap::new(),
      contract_address: format_address(interp.input.target_address()),
      caller: format_address(interp.input.caller_address()),
      value: format_u256(interp.input.call_value()),
    };

    st.steps.push(step);
  }

  fn step_end(&mut self, interp: &mut Interpreter<INTR>, _context: &mut CTX) {
    let mut st = self.shared.lock().expect("trace mutex poisoned");
    let cost = st.pre_gas_remaining.saturating_sub(interp.gas.remaining());
    if let Some(last) = st.steps.last_mut() {
      last.gas_cost = cost;
    }
  }

  fn call(&mut self, _context: &mut CTX, _inputs: &mut CallInputs) -> Option<CallOutcome> {
    None
  }

  fn call_end(&mut self, _context: &mut CTX, _inputs: &CallInputs, _outcome: &mut CallOutcome) {}

  fn create(&mut self, _context: &mut CTX, _inputs: &mut CreateInputs) -> Option<CreateOutcome> {
    None
  }

  fn create_end(&mut self, _context: &mut CTX, _inputs: &CreateInputs, _outcome: &mut CreateOutcome) {}
}

#[tauri::command]
pub async fn create_debug_session(
  state: State<'_, DebuggerManager>,
  bytecode: String,
  initial_data: String,
  value: String,
  caller: String,
) -> Result<DebugSession, String> {
  let session_id = format!(
    "debug_{}",
    std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map_err(|e| format!("Time error: {e}"))?
      .as_nanos()
  );

  let mut initcode = decode_hex_allow_0x(&bytecode)?;
  let constructor_data = decode_hex_allow_0x(&initial_data).unwrap_or_default();
  initcode.extend_from_slice(&constructor_data);

  let caller_addr = parse_address(&caller)?;
  let value_u256 = parse_u256_hex(&value);

  let ctx = revm::Context::mainnet().with_db(InMemoryDB::default());
  let evm = ctx.build_mainnet();

  let deploy_tx = TxEnv::builder()
    .caller(caller_addr)
    .gas_limit(3_000_000)
    .kind(TxKind::Create)
    .data(Bytes::from(initcode))
    .value(value_u256)
    .build_fill();

  let shared = Arc::new(Mutex::new(TraceState::default()));
  let inspector = DebugInspector::new(shared.clone());

  let mut evm = evm.with_inspector(inspector);
  let deploy = evm
    .inspect_tx(deploy_tx)
    .map_err(|e| format!("Deployment failed: {e:?}"))?;

  let steps = shared
    .lock()
    .map_err(|_| "Trace mutex poisoned".to_string())?
    .steps
    .clone();

  let (deployed_addr, final_output, gas_used, success, error) = match deploy.result {
    ExecutionResult::Success { output, gas_used, .. } => match output {
      Output::Create(_created, Some(addr)) => (format_address(addr), String::new(), gas_used, true, None),
      Output::Create(_created, None) => (
        "0x0000000000000000000000000000000000000000".to_string(),
        String::new(),
        gas_used,
        false,
        Some("Deployment succeeded but no address returned".to_string()),
      ),
      Output::Call(bytes) => (String::new(), format!("0x{}", hex::encode(bytes)), gas_used, true, None),
    },
    ExecutionResult::Revert { gas_used, output } => (
      "0x0000000000000000000000000000000000000000".to_string(),
      format!("0x{}", hex::encode(output)),
      gas_used,
      false,
      Some("Contract reverted during deployment".to_string()),
    ),
    ExecutionResult::Halt { reason, gas_used } => (
      "0x0000000000000000000000000000000000000000".to_string(),
      String::new(),
      gas_used,
      false,
      Some(format!("Execution halted during deployment: {reason:?}")),
    ),
  };

  let internal = SessionInternal {
    bytecode: bytecode.clone(),
    deployed_address: deployed_addr.clone(),
    trace: steps,
    cursor: 0,
    breakpoints: vec![],
    completed: false,
    final_output,
    gas_used,
    success,
    error,
  };

  state
    .sessions
    .lock()
    .map_err(|_| "Session mutex poisoned".to_string())?
    .insert(session_id.clone(), internal);

  Ok(DebugSession {
    session_id: session_id.clone(),
    bytecode,
    deployed_address: deployed_addr,
    breakpoints: Vec::new(),
    current_step: None,
    steps: Vec::new(),
    completed: false,
  })
}

#[tauri::command]
pub async fn execute_step(
  state: State<'_, DebuggerManager>,
  session_id: String,
  steps: u32,
) -> Result<DebugResult, String> {
  let mut sessions = state
    .sessions
    .lock()
    .map_err(|_| "Session mutex poisoned".to_string())?;
  let sess = sessions
    .get_mut(&session_id)
    .ok_or_else(|| "Unknown debug session".to_string())?;

  let n = steps.max(1) as usize;
  let start = sess.cursor.min(sess.trace.len());
  let end = (start + n).min(sess.trace.len());
  let chunk = sess.trace[start..end].to_vec();

  sess.cursor = end;
  sess.completed = sess.cursor >= sess.trace.len();

  Ok(DebugResult {
    session_id,
    steps: chunk,
    final_output: sess.final_output.clone(),
    gas_used: sess.gas_used,
    success: sess.success,
    error: sess.error.clone(),
  })
}

#[tauri::command]
pub async fn set_breakpoint(
  state: State<'_, DebuggerManager>,
  session_id: String,
  line: u32,
  condition: Option<String>,
) -> Result<bool, String> {
  let mut sessions = state
    .sessions
    .lock()
    .map_err(|_| "Session mutex poisoned".to_string())?;
  let sess = sessions
    .get_mut(&session_id)
    .ok_or_else(|| "Unknown debug session".to_string())?;

  let bp = Breakpoint {
    line,
    enabled: true,
    condition,
  };

  sess.breakpoints.retain(|b| b.line != line);
  sess.breakpoints.push(bp);
  Ok(true)
}

#[tauri::command]
pub async fn remove_breakpoint(
  state: State<'_, DebuggerManager>,
  session_id: String,
  line: u32,
) -> Result<bool, String> {
  let mut sessions = state
    .sessions
    .lock()
    .map_err(|_| "Session mutex poisoned".to_string())?;
  let sess = sessions
    .get_mut(&session_id)
    .ok_or_else(|| "Unknown debug session".to_string())?;
  sess.breakpoints.retain(|b| b.line != line);
  Ok(true)
}

#[tauri::command]
pub async fn inspect_variable(
  _state: State<'_, DebuggerManager>,
  session_id: String,
  variable_name: String,
  depth: usize,
) -> Result<String, String> {
  Ok(format!(
    "Variable {variable_name} at depth {depth} in session {session_id}: [inspection not implemented]"
  ))
}

#[tauri::command]
pub async fn get_memory_dump(
  state: State<'_, DebuggerManager>,
  session_id: String,
  offset: u64,
  length: u64,
) -> Result<Vec<String>, String> {
  let sessions = state
    .sessions
    .lock()
    .map_err(|_| "Session mutex poisoned".to_string())?;
  let sess = sessions
    .get(&session_id)
    .ok_or_else(|| "Unknown debug session".to_string())?;

  // Return memory for the current cursor-1 step (most recently produced step).
  let idx = sess.cursor.saturating_sub(1).min(sess.trace.len().saturating_sub(1));
  let mem = sess
    .trace
    .get(idx)
    .map(|s| s.memory.clone())
    .unwrap_or_default();

  let mut out = Vec::with_capacity(2 + mem.len());
  out.push(format!(
    "Session {session_id} memory dump offset {offset} length {length} (view is chunked 32B; captured during tracing)"
  ));
  out.push(format!("Captured chunks: {}", mem.len()));
  out.extend(mem);
  Ok(out)
}

#[tauri::command]
pub async fn get_storage_dump(
  _state: State<'_, DebuggerManager>,
  session_id: String,
  contract_address: String,
  slot: String,
) -> Result<String, String> {
  Ok(format!(
    "Session {session_id} storage slot {slot} at {contract_address}: [storage inspection not implemented]"
  ))
}

