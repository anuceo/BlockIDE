pub use crate::compiler::*;
pub use crate::differential_analyzer::*;
pub use crate::evm::*;
pub use crate::ipfs_client::*;
pub use crate::node_manager::*;
pub use crate::plugin_verifier::*;
pub use crate::utils::*;

use std::io::Write;
use std::process::Command;
use tempfile::NamedTempFile;

#[tauri::command]
pub async fn run_slither(code: String, _contract_name: String) -> Result<String, String> {
    // Create temporary file with contract code
    let mut temp_file = NamedTempFile::new()
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    temp_file
        .write_all(code.as_bytes())
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    let temp_path = temp_file
        .path()
        .to_str()
        .ok_or("Invalid temp path")?
        .to_string();

    // Run slither
    let output = Command::new("slither")
        .args([temp_path.as_str(), "--json", "-"])
        .output()
        .map_err(|e| format!("Failed to run slither: {}", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout).map_err(|e| format!("Invalid UTF-8 output: {}", e))
    } else {
        Err(format!(
            "Slither failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

