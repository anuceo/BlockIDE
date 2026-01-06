#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod evm;
mod utils;

fn main() {
  env_logger::init();

  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      greet,
      // EVM commands (mock)
      evm::deploy_contract,
      evm::execute_contract,
      evm::estimate_gas,
      // Utility commands
      utils::get_network_status,
      utils::check_wallet_connection,
      utils::save_file,
      utils::load_file,
      utils::list_files,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
  format!("Hello, {name}! Welcome to Blockchain IDE v0.3.0")
}

