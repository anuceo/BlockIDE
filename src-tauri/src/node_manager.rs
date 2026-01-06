use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::{Child, Command};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NodeInfo {
    pub pid: u32,
    pub node_type: String,
    pub port: u16,
    pub status: String,
    pub rpc_url: String,
    pub start_time: i64,
}

pub struct NodeManager {
    nodes: HashMap<u32, Child>,
    infos: HashMap<u32, NodeInfo>,
}

impl NodeManager {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            infos: HashMap::new(),
        }
    }
}

#[tauri::command]
pub async fn start_node(
    state: State<'_, crate::AppState>,
    node_type: String,
    port: u16,
    options: serde_json::Value,
) -> Result<NodeInfo, String> {
    let mut cmd = match node_type.as_str() {
        "ganache" => Command::new("ganache"),
        "hardhat" => Command::new("npx"),
        "solana" => Command::new("solana-test-validator"),
        _ => return Err(format!("Unsupported node type: {}", node_type)),
    };

    let args: Vec<String> = match node_type.as_str() {
        "ganache" => vec![
            "--port".to_string(),
            port.to_string(),
            "--chain.chainId".to_string(),
            options
                .get("chainId")
                .and_then(|v| v.as_u64())
                .unwrap_or(1337)
                .to_string(),
            "--wallet.seed".to_string(),
            options
                .get("mnemonic")
                .and_then(|v| v.as_str())
                .unwrap_or("test test test test test test test test test test test junk")
                .to_string(),
            "--wallet.totalAccounts".to_string(),
            options
                .get("accounts")
                .and_then(|v| v.as_u64())
                .unwrap_or(10)
                .to_string(),
        ],
        "hardhat" => {
            let mut a = vec!["hardhat".to_string(), "node".to_string(), "--port".to_string(), port.to_string()];
            if let Some(fork) = options.get("fork").and_then(|v| v.as_str()) {
                a.push("--fork".to_string());
                a.push(fork.to_string());
            }
            a
        }
        "solana" => vec![
            "--reset".to_string(),
            "--rpc-port".to_string(),
            port.to_string(),
        ],
        _ => vec![],
    };

    cmd.args(args);

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start {} node: {}", node_type, e))?;

    let pid = child.id();

    let info = NodeInfo {
        pid,
        node_type: node_type.clone(),
        port,
        status: "running".to_string(),
        rpc_url: format!("http://localhost:{}", port),
        start_time: chrono::Utc::now().timestamp(),
    };

    let mut nm = state.node_manager.lock().unwrap();
    nm.nodes.insert(pid, child);
    nm.infos.insert(pid, info.clone());

    Ok(info)
}

#[tauri::command]
pub async fn stop_node(state: State<'_, crate::AppState>, pid: u32) -> Result<(), String> {
    let mut nm = state.node_manager.lock().unwrap();
    if let Some(mut child) = nm.nodes.remove(&pid) {
        child
            .kill()
            .map_err(|e| format!("Failed to stop node {}: {}", pid, e))?;
    }
    nm.infos.remove(&pid);
    Ok(())
}

#[tauri::command]
pub async fn get_node_status(state: State<'_, crate::AppState>, pid: u32) -> Result<NodeInfo, String> {
    let nm = state.node_manager.lock().unwrap();
    if let Some(info) = nm.infos.get(&pid) {
        Ok(info.clone())
    } else {
        Err(format!("Node {} not found", pid))
    }
}

