use ethers_signers::{coins_bip39::English, MnemonicBuilder, Signer};
use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::net::TcpListener;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

#[derive(Clone, Serialize)]
pub struct NodeStatus {
  pub pid: u32,
  pub port: u32,
  pub rpc_url: String,
  pub chain_id: u64,
  pub started_at: u64,
  pub is_running: bool,
  pub logs: Vec<String>,
}

#[derive(Clone, Serialize)]
pub struct LocalAccount {
  pub address: String,
  pub private_key: String,
  pub balance: String,
}

#[derive(Clone)]
pub struct NodeManager {
  nodes: Arc<Mutex<Vec<NodeRecord>>>,
  app_handle: AppHandle,
}

struct NodeRecord {
  child: Child,
  status: NodeStatus,
  mnemonic: Option<String>,
}

impl NodeManager {
  pub fn new(app_handle: AppHandle) -> Self {
    Self {
      nodes: Arc::new(Mutex::new(Vec::new())),
      app_handle,
    }
  }

  fn port_available(port: u32) -> bool {
    TcpListener::bind(("127.0.0.1", port as u16)).is_ok()
  }

  fn push_log(nodes: &Arc<Mutex<Vec<NodeRecord>>>, pid: u32, line: String) -> bool {
    let mut nodes_guard = nodes.lock().unwrap();
    if let Some(node) = nodes_guard.iter_mut().find(|n| n.status.pid == pid) {
      node.status.logs.push(line);
      if node.status.logs.len() > 200 {
        node.status.logs.drain(0..(node.status.logs.len() - 200));
      }
      true
    } else {
      false
    }
  }

  fn emit_log(app: &AppHandle, pid: u32, line: &str) {
    let _ = app.emit("node-log", (pid, line.to_string()));
  }

  fn start_log_threads(
    &self,
    pid: u32,
    mut stdout: Option<std::process::ChildStdout>,
    mut stderr: Option<std::process::ChildStderr>,
  ) {
    let nodes = self.nodes.clone();
    let app = self.app_handle.clone();

    if let Some(out) = stdout.take() {
      let nodes = nodes.clone();
      let app = app.clone();
      std::thread::spawn(move || {
        let reader = BufReader::new(out);
        for line in reader.lines().flatten() {
          if !Self::push_log(&nodes, pid, line.clone()) {
            break;
          }
          Self::emit_log(&app, pid, &line);
        }
      });
    }

    if let Some(err) = stderr.take() {
      let nodes = nodes.clone();
      let app = app.clone();
      std::thread::spawn(move || {
        let reader = BufReader::new(err);
        for line in reader.lines().flatten() {
          let line = format!("[stderr] {line}");
          if !Self::push_log(&nodes, pid, line.clone()) {
            break;
          }
          Self::emit_log(&app, pid, &line);
        }
      });
    }

    // Lightweight health/exit monitor.
    let nodes = self.nodes.clone();
    let app = self.app_handle.clone();
    std::thread::spawn(move || {
      let start = Instant::now();
      loop {
        std::thread::sleep(Duration::from_secs(3));
        let mut nodes_guard = nodes.lock().unwrap();
        let Some(node) = nodes_guard.iter_mut().find(|n| n.status.pid == pid) else {
          break;
        };

        match node.child.try_wait() {
          Ok(Some(status)) => {
            node.status.is_running = false;
            node.status
              .logs
              .push(format!("Process exited: {status}"));
            let _ = app.emit("node-stopped", pid);
            break;
          }
          Ok(None) => {
            if start.elapsed().as_secs() % 15 == 0 {
              node.status.logs.push(format!(
                "Node {} running for {}s",
                pid,
                start.elapsed().as_secs()
              ));
            }
          }
          Err(e) => {
            node.status.is_running = false;
            node.status.logs.push(format!("Failed to poll process: {e}"));
            let _ = app.emit("node-stopped", pid);
            break;
          }
        }
      }
    });
  }

  async fn start_ganache_impl(
    &self,
    port: u32,
    chain_id: u64,
    accounts: u32,
    mnemonic: Option<String>,
    block_time: Option<u64>,
  ) -> Result<NodeStatus, String> {
    if !Self::port_available(port) {
      return Err(format!("Port {port} is already in use"));
    }

    let rpc_url = format!("http://127.0.0.1:{port}");

    let mut cmd = Command::new("ganache");
    cmd.arg("--port")
      .arg(port.to_string())
      .arg("--chain.chainId")
      .arg(chain_id.to_string())
      .arg("--wallet.totalAccounts")
      .arg(accounts.to_string())
      .arg("--server.host")
      .arg("127.0.0.1")
      .arg("--logging.verbose")
      .arg("--database.dbPath")
      .arg(format!("/tmp/ganache_{port}"))
      .stdout(Stdio::piped())
      .stderr(Stdio::piped());

    let mnemonic_to_store = mnemonic.clone();
    if let Some(m) = mnemonic {
      cmd.arg("--wallet.mnemonic").arg(m);
    }
    if let Some(bt) = block_time {
      cmd.arg("--miner.blockTime").arg(bt.to_string());
    }

    let mut child = cmd.spawn().map_err(|e| {
      format!(
        "Failed to start Ganache: {e}. Make sure ganache is installed (`npm install -g ganache`)."
      )
    })?;

    let pid = child.id();
    let started_at = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map_err(|e| e.to_string())?
      .as_secs();

    let status = NodeStatus {
      pid,
      port,
      rpc_url: rpc_url.clone(),
      chain_id,
      started_at,
      is_running: true,
      logs: vec![format!("Ganache started on {rpc_url}")],
    };

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    {
      let mut nodes = self.nodes.lock().unwrap();
      nodes.push(NodeRecord {
        child,
        status: status.clone(),
        mnemonic: mnemonic_to_store,
      });
    }

    self.start_log_threads(pid, stdout, stderr);
    Ok(status)
  }

  async fn start_anvil_impl(&self, port: u32, chain_id: u64) -> Result<NodeStatus, String> {
    if !Self::port_available(port) {
      return Err(format!("Port {port} is already in use"));
    }

    let rpc_url = format!("http://127.0.0.1:{port}");

    let mut cmd = Command::new("anvil");
    cmd.arg("--port")
      .arg(port.to_string())
      .arg("--chain-id")
      .arg(chain_id.to_string())
      .arg("--host")
      .arg("127.0.0.1")
      .stdout(Stdio::piped())
      .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| {
      format!("Failed to start Anvil: {e}. Make sure anvil is installed (`foundryup`).")
    })?;

    let pid = child.id();
    let started_at = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map_err(|e| e.to_string())?
      .as_secs();

    let status = NodeStatus {
      pid,
      port,
      rpc_url: rpc_url.clone(),
      chain_id,
      started_at,
      is_running: true,
      logs: vec![format!("Anvil started on {rpc_url}")],
    };

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    {
      let mut nodes = self.nodes.lock().unwrap();
      nodes.push(NodeRecord {
        child,
        status: status.clone(),
        mnemonic: None,
      });
    }

    self.start_log_threads(pid, stdout, stderr);
    Ok(status)
  }

  fn stop_node_impl(&self, pid: u32) -> Result<bool, String> {
    let mut nodes = self.nodes.lock().unwrap();
    if let Some(pos) = nodes.iter().position(|n| n.status.pid == pid) {
      let mut node = nodes.remove(pos);
      node.status.is_running = false;
      let _ = node.child.kill();
      let _ = node.child.wait();
      let _ = self.app_handle.emit("node-stopped", pid);
      Ok(true)
    } else {
      Err(format!("Node with PID {pid} not found"))
    }
  }

  fn get_nodes_impl(&self) -> Vec<NodeStatus> {
    let nodes = self.nodes.lock().unwrap();
    nodes.iter().map(|n| n.status.clone()).collect()
  }

  fn get_default_accounts_impl(&self, pid: u32) -> Result<Vec<LocalAccount>, String> {
    let nodes = self.nodes.lock().unwrap();
    let node = nodes
      .iter()
      .find(|n| n.status.pid == pid)
      .ok_or_else(|| "Node not found".to_string())?;

    // If Ganache was started with an explicit mnemonic, use it. Otherwise use the common test mnemonic.
    let mnemonic = node
      .mnemonic
      .clone()
      .unwrap_or_else(|| "test test test test test test test test test test test junk".to_string());

    let mut accounts = Vec::new();
    for i in 0..10u32 {
      let wallet = MnemonicBuilder::<English>::default()
        .phrase(mnemonic.as_str())
        .index(i)
        .map_err(|e| format!("Derivation path error: {e}"))?
        .build()
        .map_err(|e| format!("Mnemonic error: {e}"))?;

      let pk = wallet.signer().to_bytes();
      accounts.push(LocalAccount {
        address: format!("{:?}", wallet.address()),
        private_key: format!("0x{}", hex::encode(pk)),
        balance: "1000000000000000000000".to_string(),
      });
    }

    Ok(accounts)
  }
}

// ---- Tauri command wrappers (State<NodeManager>) ----

#[tauri::command]
pub async fn start_ganache(
  manager: State<'_, NodeManager>,
  port: u32,
  chain_id: u64,
  accounts: u32,
  mnemonic: Option<String>,
  block_time: Option<u64>,
) -> Result<NodeStatus, String> {
  manager
    .start_ganache_impl(port, chain_id, accounts, mnemonic, block_time)
    .await
}

#[tauri::command]
pub async fn start_anvil(
  manager: State<'_, NodeManager>,
  port: u32,
  chain_id: u64,
) -> Result<NodeStatus, String> {
  manager.start_anvil_impl(port, chain_id).await
}

#[tauri::command]
pub async fn stop_node(manager: State<'_, NodeManager>, pid: u32) -> Result<bool, String> {
  manager.stop_node_impl(pid)
}

#[tauri::command]
pub async fn get_nodes(manager: State<'_, NodeManager>) -> Result<Vec<NodeStatus>, String> {
  Ok(manager.get_nodes_impl())
}

#[tauri::command]
pub async fn get_default_accounts(
  manager: State<'_, NodeManager>,
  pid: u32,
) -> Result<Vec<LocalAccount>, String> {
  manager.get_default_accounts_impl(pid)
}

