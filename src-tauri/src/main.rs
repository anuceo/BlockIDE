#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod evm;
mod plugin_verifier;
mod differential_analyzer;
mod ipfs_client;
mod utils;
mod compiler;
mod node_manager;

use commands::*;
use std::sync::Mutex;
use tauri::{Manager, WindowEvent};

pub struct AppState {
    pub node_manager: Mutex<node_manager::NodeManager>,
}

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .manage(AppState {
            node_manager: Mutex::new(node_manager::NodeManager::new()),
        })
        .invoke_handler(tauri::generate_handler![
            // Core commands
            greet,
            // EVM commands
            evm::deploy_contract,
            evm::execute_contract,
            evm::estimate_gas,
            // Compiler commands
            compiler::compile_solidity,
            compiler::validate_solidity,
            // Security commands
            differential_analyzer::analyze_security,
            differential_analyzer::compare_versions,
            commands::run_slither,
            // Plugin commands
            plugin_verifier::verify_plugin,
            plugin_verifier::load_plugin,
            // IPFS commands
            ipfs_client::upload_to_ipfs,
            ipfs_client::pin_json,
            // Node manager commands
            node_manager::start_node,
            node_manager::stop_node,
            node_manager::get_node_status,
            // Utility commands
            utils::get_network_status,
            utils::check_wallet_connection,
            utils::save_file,
            utils::load_file,
            utils::list_files,
        ])
        .setup(|app| {
            // Initialize global state (stubbed, but ready for real implementations)
            let evm_state = evm::EVMState::new();
            app.manage(evm_state);

            let plugin_manager = plugin_verifier::PluginManager::new();
            app.manage(plugin_manager);

            let ipfs_client = ipfs_client::IPFSClient::new("http://localhost:5001");
            app.manage(ipfs_client);

            let diff_analyzer = differential_analyzer::DifferentialAnalyzer::new();
            app.manage(diff_analyzer);

            Ok(())
        })
        .on_window_event(|event| {
            if let WindowEvent::CloseRequested { .. } = event.event() {
                log::info!("Cleaning up resources...");
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Blockchain IDE v0.3.0", name)
}

