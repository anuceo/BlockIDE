use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::Command;
use tempfile::NamedTempFile;

#[derive(Debug, Serialize, Deserialize)]
pub struct CompilationResult {
    pub success: bool,
    pub bytecode: Option<String>,
    pub abi: Option<serde_json::Value>,
    pub errors: Vec<CompilationError>,
    pub warnings: Vec<CompilationWarning>,
    pub contract_name: Option<String>,
    pub compiler_version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompilationError {
    pub severity: String,
    pub component: String,
    pub formatted_message: String,
    pub source_location: Option<SourceLocation>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompilationWarning {
    pub message: String,
    pub line: usize,
    pub column: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SourceLocation {
    pub file: String,
    pub start: usize,
    pub end: usize,
}

#[tauri::command]
pub async fn compile_solidity(code: String, version: Option<String>) -> Result<CompilationResult, String> {
    let solc_version = version.unwrap_or_else(|| "0.8.19".to_string());

    // Create temporary file
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

    // Try to compile using solc
    let output = Command::new("solc")
        .args([temp_path.as_str(), "--combined-json", "abi,bin", "--allow-paths", "."])
        .output();

    match output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let json: serde_json::Value =
                serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse solc output: {}", e))?;

            let contracts = json
                .get("contracts")
                .and_then(|c| c.as_object())
                .ok_or("No contracts in output")?;

            let (contract_name, contract_data) = contracts.iter().next().ok_or("No contract data found")?;

            let bytecode = contract_data
                .get("bin")
                .and_then(|b| b.as_str())
                .map(|s| s.to_string());

            let abi = contract_data.get("abi").cloned();

            Ok(CompilationResult {
                success: true,
                bytecode,
                abi,
                errors: vec![],
                warnings: vec![],
                contract_name: Some(contract_name.to_string()),
                compiler_version: solc_version,
            })
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Ok(CompilationResult {
                success: false,
                bytecode: None,
                abi: None,
                errors: vec![CompilationError {
                    severity: "error".to_string(),
                    component: "solc".to_string(),
                    formatted_message: stderr.to_string(),
                    source_location: None,
                }],
                warnings: vec![],
                contract_name: None,
                compiler_version: solc_version,
            })
        }
        Err(e) => Ok(CompilationResult {
            success: false,
            bytecode: None,
            abi: None,
            errors: vec![CompilationError {
                severity: "error".to_string(),
                component: "system".to_string(),
                formatted_message: format!("Failed to execute solc: {}", e),
                source_location: None,
            }],
            warnings: vec![],
            contract_name: None,
            compiler_version: solc_version,
        }),
    }
}

#[tauri::command]
pub async fn validate_solidity(code: String) -> Result<Vec<CompilationError>, String> {
    Ok(validate_solidity_code(&code))
}

fn validate_solidity_code(code: &str) -> Vec<CompilationError> {
    let mut errors = Vec::new();

    if !code.contains("pragma solidity") {
        errors.push(CompilationError {
            severity: "warning".to_string(),
            component: "validator".to_string(),
            formatted_message: "Missing pragma solidity directive".to_string(),
            source_location: None,
        });
    }

    if !code.contains("contract") && !code.contains("library") && !code.contains("interface") {
        errors.push(CompilationError {
            severity: "warning".to_string(),
            component: "validator".to_string(),
            formatted_message: "No contract, library, or interface definition found".to_string(),
            source_location: None,
        });
    }

    // Simple security heuristics
    for (i, line) in code.lines().enumerate() {
        if line.contains("tx.origin") {
            errors.push(CompilationError {
                severity: "warning".to_string(),
                component: "security".to_string(),
                formatted_message: "Use of tx.origin for authorization".to_string(),
                source_location: Some(SourceLocation {
                    file: "contract.sol".to_string(),
                    start: i + 1,
                    end: i + 1,
                }),
            });
        }
    }

    errors
}

