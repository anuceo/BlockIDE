use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::{Command, Stdio};
use tempfile::NamedTempFile;

#[derive(Debug, Serialize, Deserialize)]
pub struct CompilationResult {
  /// `solc --version` output (best-effort).
  pub solc_version: Option<String>,
  pub contracts: Vec<CompiledContract>,
  pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompiledContract {
  pub name: String,
  pub abi: serde_json::Value,
  /// Hex string without 0x prefix, per solc combined-json `bin` convention.
  pub bin: String,
  pub metadata: Option<String>,
}

fn try_compiler_version(cmd: &str) -> Option<String> {
  let out = Command::new(cmd).arg("--version").output().ok()?;
  if !out.status.success() {
    return None;
  }
  Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

fn pick_solc_command() -> Option<&'static str> {
  // Prefer native solc; fall back to solcjs (installed by `npm i -g solc`).
  if try_compiler_version("solc").is_some() {
    return Some("solc");
  }
  if try_compiler_version("solcjs").is_some() {
    return Some("solcjs");
  }
  None
}

#[tauri::command]
pub async fn compile_solidity_real(
  code: String,
  _version: String,
  optimize: bool,
) -> Result<CompilationResult, String> {
  // Note: `_version` is currently not used. Real version management typically uses
  // solc-select, svm-rs, or `solcjs` with explicit binary resolution.

  // 1) Write Solidity to a temp file.
  let mut temp_file = NamedTempFile::new().map_err(|e| format!("tempfile error: {e}"))?;
  temp_file
    .write_all(code.as_bytes())
    .map_err(|e| format!("failed to write temp .sol file: {e}"))?;

  // 2) Run solc (or solcjs fallback).
  let solc_cmd = pick_solc_command().ok_or_else(|| {
    "no Solidity compiler found. Install `solc` (native) or `solcjs` (via `npm i -g solc`) and ensure it is on PATH."
      .to_string()
  })?;

  let mut cmd = Command::new(solc_cmd);
  cmd.arg("--combined-json")
    .arg("abi,bin,metadata")
    .arg("--allow-paths")
    .arg(".")
    .arg(temp_file.path())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

  if optimize {
    cmd.arg("--optimize").arg("--optimize-runs").arg("200");
  }

  let output = cmd
    .output()
    .map_err(|e| format!("failed to execute `{solc_cmd}` ({e})"))?;

  let stderr = String::from_utf8_lossy(&output.stderr).to_string();
  if !output.status.success() {
    return Err(format!("{solc_cmd} failed:\n{stderr}"));
  }

  // 3) Parse JSON output.
  let stdout = String::from_utf8_lossy(&output.stdout);
  let v: serde_json::Value =
    serde_json::from_str(&stdout).map_err(|e| format!("invalid solc JSON: {e}"))?;

  let mut warnings = Vec::new();
  for line in stderr.lines() {
    // Solc warnings typically contain "Warning:"; keep it simple and forward.
    if line.contains("Warning:") {
      warnings.push(line.to_string());
    }
  }

  let contracts_obj = v
    .get("contracts")
    .and_then(|c| c.as_object())
    .ok_or_else(|| "solc output missing `contracts` object".to_string())?;

  let mut contracts = Vec::new();
  for (full_name, contract_val) in contracts_obj {
    let abi_str = contract_val
      .get("abi")
      .and_then(|x| x.as_str())
      .ok_or_else(|| format!("solc contract `{full_name}` missing `abi`"))?;
    let abi_json: serde_json::Value =
      serde_json::from_str(abi_str).map_err(|e| format!("abi JSON parse error: {e}"))?;

    let bin = contract_val
      .get("bin")
      .and_then(|x| x.as_str())
      .unwrap_or_default()
      .to_string();

    let metadata = contract_val
      .get("metadata")
      .and_then(|x| x.as_str())
      .map(|s| s.to_string());

    // full_name is like "/tmp/solc...tmp:ContractName"
    let name = full_name
      .split(':')
      .last()
      .unwrap_or(full_name.as_str())
      .to_string();

    contracts.push(CompiledContract {
      name,
      abi: abi_json,
      bin,
      metadata,
    });
  }

  Ok(CompilationResult {
    solc_version: try_compiler_version(solc_cmd),
    contracts,
    warnings,
  })
}

