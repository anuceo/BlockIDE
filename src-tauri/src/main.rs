#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod differential_analyzer;
mod evm;
mod ipfs_client;
mod plugin_verifier;
mod utils;

use tauri::WindowEvent;

#[tauri::command]
fn greet(name: &str) -> String {
  format!("Hello, {}! Blockchain IDE is ready.", name)
}

fn main() {
  env_logger::init();

  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      greet,
      // EVM Commands
      evm::deploy_contract,
      evm::execute_contract,
      evm::estimate_gas,
      evm::compile_solidity,
      // Security Commands
      differential_analyzer::analyze_security,
      differential_analyzer::compare_versions,
      // Plugin Commands
      plugin_verifier::verify_plugin,
      plugin_verifier::load_plugin,
      // IPFS Commands
      ipfs_client::upload_to_ipfs,
      ipfs_client::pin_json,
      // Utility Commands
      utils::get_network_status,
      utils::check_wallet_connection,
    ])
    .setup(|app| {
      app.manage(evm::EVMState::new());
      app.manage(plugin_verifier::PluginManager::new());
      app.manage(differential_analyzer::AnalyzerState::new());
      app.manage(ipfs_client::IPFSClient::new("http://localhost:5001"));
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

