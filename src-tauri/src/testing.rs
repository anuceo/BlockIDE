use serde::{Deserialize, Serialize};
use std::{
  fs,
  path::{Path, PathBuf},
  process::{Command, Stdio},
  time::Instant,
};
use tempfile::TempDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct TestResult {
  pub name: String,
  pub passed: bool,
  pub duration: f64,
  pub error: Option<String>,
  pub logs: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestSuiteResult {
  pub framework: String,
  pub total: usize,
  pub passed: usize,
  pub failed: usize,
  pub duration: f64,
  pub results: Vec<TestResult>,
  pub coverage: Option<CoverageReport>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CoverageReport {
  pub statements: f64,
  pub branches: f64,
  pub functions: f64,
  pub lines: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "PascalCase")]
pub enum TestFramework {
  Hardhat,
  Foundry,
  Truffle,
}

#[derive(Debug, Deserialize)]
pub struct RunTestsArgs {
  pub code: String,
  #[serde(alias = "testCode", alias = "test_code")]
  pub test_code: String,
  pub framework: TestFramework,
  pub optimize: bool,
}

#[tauri::command]
pub async fn run_tests(args: RunTestsArgs) -> Result<TestSuiteResult, String> {
  let temp_dir = TempDir::new().map_err(|e| format!("Failed to create temp directory: {e}"))?;
  let project_path = temp_dir.path();

  // Contract file
  let contract_path = project_path.join("contracts/TestContract.sol");
  fs::create_dir_all(contract_path.parent().unwrap())
    .map_err(|e| format!("Failed to create contracts directory: {e}"))?;
  fs::write(&contract_path, &args.code).map_err(|e| format!("Failed to write contract file: {e}"))?;

  // Test file
  let test_path = match args.framework {
    TestFramework::Hardhat => project_path.join("test/TestContract.test.js"),
    TestFramework::Foundry => project_path.join("test/TestContract.t.sol"),
    TestFramework::Truffle => project_path.join("test/TestContract.test.js"),
  };
  fs::create_dir_all(test_path.parent().unwrap())
    .map_err(|e| format!("Failed to create test directory: {e}"))?;
  fs::write(&test_path, &args.test_code).map_err(|e| format!("Failed to write test file: {e}"))?;

  match args.framework {
    TestFramework::Hardhat => {
      create_hardhat_project(project_path, args.optimize)?;
      run_hardhat_tests(project_path)
    }
    TestFramework::Foundry => {
      create_foundry_config(project_path)?;
      run_foundry_tests(project_path)
    }
    TestFramework::Truffle => {
      create_truffle_project(project_path)?;
      run_truffle_tests(project_path)
    }
  }
}

fn run_cmd(mut cmd: Command) -> Result<std::process::Output, String> {
  cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
  cmd.output().map_err(|e| format!("Failed to spawn process: {e}"))
}

fn require_tool(tool: &str) -> Result<(), String> {
  let ok = Command::new(tool)
    .arg("--version")
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .status()
    .is_ok();
  if ok {
    Ok(())
  } else {
    Err(format!(
      "Required tool `{tool}` is not available on PATH. Run scripts/install-tools.sh (or install it manually)."
    ))
  }
}

fn run_hardhat_tests(project_path: &Path) -> Result<TestSuiteResult, String> {
  require_tool("npm")?;

  let start = Instant::now();

  // Install deps
  let mut install_cmd = Command::new("npm");
  install_cmd.current_dir(project_path).arg("install");
  let install = run_cmd(install_cmd)?;
  if !install.status.success() {
    return Err(format!(
      "Hardhat dependency install failed:\n{}\n{}",
      String::from_utf8_lossy(&install.stdout),
      String::from_utf8_lossy(&install.stderr)
    ));
  }

  let mut test_cmd = Command::new("npx");
  test_cmd
    .current_dir(project_path)
    .arg("--yes")
    .arg("hardhat")
    .arg("test");
  let output = run_cmd(test_cmd)?;

  let mut suite = parse_hardhat_output(&output)?;
  suite.duration = start.elapsed().as_secs_f64();
  Ok(suite)
}

fn run_foundry_tests(project_path: &Path) -> Result<TestSuiteResult, String> {
  require_tool("forge")?;

  let start = Instant::now();
  let mut cmd = Command::new("forge");
  cmd.current_dir(project_path)
    .arg("test")
    .arg("--verbosity")
    .arg("2");
  let output = run_cmd(cmd)?;

  let mut suite = parse_foundry_output(&output)?;
  suite.duration = start.elapsed().as_secs_f64();
  Ok(suite)
}

fn run_truffle_tests(project_path: &Path) -> Result<TestSuiteResult, String> {
  require_tool("npm")?;

  let start = Instant::now();

  let mut install_cmd = Command::new("npm");
  install_cmd.current_dir(project_path).arg("install");
  let install = run_cmd(install_cmd)?;
  if !install.status.success() {
    return Err(format!(
      "Truffle dependency install failed:\n{}\n{}",
      String::from_utf8_lossy(&install.stdout),
      String::from_utf8_lossy(&install.stderr)
    ));
  }

  let mut test_cmd = Command::new("npx");
  test_cmd
    .current_dir(project_path)
    .arg("--yes")
    .arg("truffle")
    .arg("test");
  let output = run_cmd(test_cmd)?;

  let mut suite = parse_truffle_output(&output)?;
  suite.duration = start.elapsed().as_secs_f64();
  Ok(suite)
}

fn parse_hardhat_output(output: &std::process::Output) -> Result<TestSuiteResult, String> {
  let stdout = String::from_utf8_lossy(&output.stdout);
  let stderr = String::from_utf8_lossy(&output.stderr);

  let mut results = Vec::new();
  let mut passed = 0;
  let mut failed = 0;

  for line in stdout.lines() {
    if line.contains('✓') {
      if let Some(name) = line.split('✓').nth(1) {
        results.push(TestResult {
          name: name.trim().to_string(),
          passed: true,
          duration: 0.0,
          error: None,
          logs: vec![],
        });
        passed += 1;
      }
    } else if line.contains('✗') {
      if let Some(name) = line.split('✗').nth(1) {
        results.push(TestResult {
          name: name.trim().to_string(),
          passed: false,
          duration: 0.0,
          error: Some("Test failed".to_string()),
          logs: vec![],
        });
        failed += 1;
      }
    }
  }

  // If we couldn't parse, include stderr and fail as a single test.
  if results.is_empty() && !output.status.success() {
    results.push(TestResult {
      name: "hardhat".to_string(),
      passed: false,
      duration: 0.0,
      error: Some("Hardhat test run failed".to_string()),
      logs: vec![stdout.to_string(), stderr.to_string()],
    });
    failed = 1;
  }

  Ok(TestSuiteResult {
    framework: "hardhat".to_string(),
    total: passed + failed,
    passed,
    failed,
    duration: 0.0,
    results,
    coverage: None,
  })
}

fn parse_foundry_output(output: &std::process::Output) -> Result<TestSuiteResult, String> {
  let stdout = String::from_utf8_lossy(&output.stdout);
  let stderr = String::from_utf8_lossy(&output.stderr);

  let mut results = Vec::new();
  let mut passed = 0;
  let mut failed = 0;

  for line in stdout.lines() {
    if line.contains("[PASS]") {
      if let Some(name) = line.split("[PASS]").nth(1) {
        results.push(TestResult {
          name: name.trim().to_string(),
          passed: true,
          duration: 0.0,
          error: None,
          logs: vec![],
        });
        passed += 1;
      }
    } else if line.contains("[FAIL]") {
      if let Some(name) = line.split("[FAIL]").nth(1) {
        results.push(TestResult {
          name: name.trim().to_string(),
          passed: false,
          duration: 0.0,
          error: Some("Test failed".to_string()),
          logs: vec![],
        });
        failed += 1;
      }
    }
  }

  if results.is_empty() && !output.status.success() {
    results.push(TestResult {
      name: "foundry".to_string(),
      passed: false,
      duration: 0.0,
      error: Some("Foundry test run failed".to_string()),
      logs: vec![stdout.to_string(), stderr.to_string()],
    });
    failed = 1;
  }

  Ok(TestSuiteResult {
    framework: "foundry".to_string(),
    total: passed + failed,
    passed,
    failed,
    duration: 0.0,
    results,
    coverage: None,
  })
}

fn parse_truffle_output(output: &std::process::Output) -> Result<TestSuiteResult, String> {
  let stdout = String::from_utf8_lossy(&output.stdout);
  let stderr = String::from_utf8_lossy(&output.stderr);

  let mut results = Vec::new();
  let mut passed = 0;
  let mut failed = 0;

  for line in stdout.lines() {
    if line.contains('✓') {
      if let Some(name) = line.split('✓').nth(1) {
        results.push(TestResult {
          name: name.trim().to_string(),
          passed: true,
          duration: 0.0,
          error: None,
          logs: vec![],
        });
        passed += 1;
      }
    } else if line.contains('✗') {
      if let Some(name) = line.split('✗').nth(1) {
        results.push(TestResult {
          name: name.trim().to_string(),
          passed: false,
          duration: 0.0,
          error: Some("Test failed".to_string()),
          logs: vec![],
        });
        failed += 1;
      }
    }
  }

  if results.is_empty() && !output.status.success() {
    results.push(TestResult {
      name: "truffle".to_string(),
      passed: false,
      duration: 0.0,
      error: Some("Truffle test run failed".to_string()),
      logs: vec![stdout.to_string(), stderr.to_string()],
    });
    failed = 1;
  }

  Ok(TestSuiteResult {
    framework: "truffle".to_string(),
    total: passed + failed,
    passed,
    failed,
    duration: 0.0,
    results,
    coverage: None,
  })
}

fn write_json(path: PathBuf, value: &serde_json::Value) -> Result<(), String> {
  fs::write(&path, serde_json::to_vec_pretty(value).map_err(|e| format!("JSON encode failed: {e}"))?)
    .map_err(|e| format!("Failed to write {}: {e}", path.display()))
}

fn create_hardhat_project(project_path: &Path, optimize: bool) -> Result<(), String> {
  // package.json with hardhat + toolbox so tests can use ethers/chai.
  write_json(
    project_path.join("package.json"),
    &serde_json::json!({
      "name": "temp-hardhat-project",
      "private": true,
      "type": "commonjs",
      "devDependencies": {
        "hardhat": "^2.22.0",
        "@nomicfoundation/hardhat-toolbox": "^5.0.0"
      }
    }),
  )?;

  // Hardhat config
  let config = if optimize {
    r#"
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: { hardhat: { chainId: 1337 } }
};
"#
  } else {
    r#"
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: { version: "0.8.19" },
  networks: { hardhat: { chainId: 1337 } }
};
"#
  };
  fs::write(project_path.join("hardhat.config.js"), config)
    .map_err(|e| format!("Failed to write Hardhat config: {e}"))?;
  Ok(())
}

fn create_foundry_config(project_path: &Path) -> Result<(), String> {
  let config = r#"
[profile.default]
src = "contracts"
out = "out"
libs = ["lib"]
solc_version = "0.8.19"
optimizer = true
optimizer_runs = 200
"#;
  fs::write(project_path.join("foundry.toml"), config)
    .map_err(|e| format!("Failed to write Foundry config: {e}"))
}

fn create_truffle_project(project_path: &Path) -> Result<(), String> {
  write_json(
    project_path.join("package.json"),
    &serde_json::json!({
      "name": "temp-truffle-project",
      "private": true,
      "type": "commonjs",
      "devDependencies": {
        "truffle": "^5.11.0"
      }
    }),
  )?;

  let config = r#"
module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*"
    }
  },
  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: { enabled: true, runs: 200 }
      }
    }
  }
};
"#;
  fs::write(project_path.join("truffle-config.js"), config)
    .map_err(|e| format!("Failed to write Truffle config: {e}"))?;
  Ok(())
}

