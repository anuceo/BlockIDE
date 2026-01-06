use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Vulnerability {
  pub id: String,
  pub severity: String,
  pub description: String,
  pub location: CodeLocation,
  pub mitigation: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CodeLocation {
  pub file: String,
  pub line: usize,
  pub column: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SecurityReport {
  pub vulnerabilities: Vec<Vulnerability>,
  pub gas_estimates: GasReport,
  pub storage_layout: StorageLayout,
  pub timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GasReport {
  pub deployment: u64,
  pub average_execution: u64,
  pub max_execution: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StorageLayout {
  pub slots_used: usize,
  pub variables: Vec<StorageVariable>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StorageVariable {
  pub name: String,
  pub slot: u64,
  pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffAnalysis {
  pub added_vulnerabilities: Vec<Vulnerability>,
  pub fixed_vulnerabilities: Vec<Vulnerability>,
  pub gas_delta: i64,
  pub storage_changes: Vec<StorageChange>,
  pub overall_risk_change: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StorageChange {
  pub variable: String,
  pub change: String,
}

pub struct DifferentialAnalyzer {
  reports: HashMap<String, SecurityReport>,
}

impl DifferentialAnalyzer {
  pub fn new() -> Self {
    Self {
      reports: HashMap::new(),
    }
  }

  pub fn analyze(&self, _code: &str) -> SecurityReport {
    // Mock analysis - in production, integrate with Slither/Mythril (via WASM plugins)
    SecurityReport {
      vulnerabilities: vec![Vulnerability {
        id: "REENTRANCY".to_string(),
        severity: "HIGH".to_string(),
        description: "Possible reentrancy vulnerability".to_string(),
        location: CodeLocation {
          file: "contract.sol".to_string(),
          line: 42,
          column: 12,
        },
        mitigation: "Use Checks-Effects-Interactions pattern".to_string(),
      }],
      gas_estimates: GasReport {
        deployment: 1_000_000,
        average_execution: 50_000,
        max_execution: 200_000,
      },
      storage_layout: StorageLayout {
        slots_used: 10,
        variables: vec![StorageVariable {
          name: "balances".to_string(),
          slot: 0,
          size: 32,
        }],
      },
      timestamp: chrono::Utc::now().timestamp() as u64,
    }
  }

  pub fn compare(&mut self, contract_id: &str, new_report: SecurityReport) -> DiffAnalysis {
    let old_report = self.reports.get(contract_id).cloned();

    let (added, fixed, gas_delta) = match old_report {
      Some(old) => {
        let added: Vec<Vulnerability> = new_report
          .vulnerabilities
          .iter()
          .filter(|v| !old.vulnerabilities.iter().any(|ov| ov.id == v.id))
          .cloned()
          .collect();

        let fixed: Vec<Vulnerability> = old
          .vulnerabilities
          .iter()
          .filter(|v| !new_report.vulnerabilities.iter().any(|nv| nv.id == v.id))
          .cloned()
          .collect();

        (
          added,
          fixed,
          new_report.gas_estimates.deployment as i64 - old.gas_estimates.deployment as i64,
        )
      }
      None => (vec![], vec![], 0),
    };

    self.reports.insert(contract_id.to_string(), new_report);

    DiffAnalysis {
      added_vulnerabilities: added,
      fixed_vulnerabilities: fixed,
      gas_delta,
      storage_changes: vec![],
      overall_risk_change: "Improved".to_string(),
    }
  }
}

pub struct AnalyzerState(Mutex<DifferentialAnalyzer>);

impl AnalyzerState {
  pub fn new() -> Self {
    Self(Mutex::new(DifferentialAnalyzer::new()))
  }
}

#[tauri::command]
pub async fn analyze_security(code: String, _contract_id: Option<String>, analyzer: State<'_, AnalyzerState>) -> Result<SecurityReport, String> {
  let analyzer = analyzer.0.lock().map_err(|_| "Analyzer lock poisoned".to_string())?;
  Ok(analyzer.analyze(&code))
}

#[tauri::command]
pub async fn compare_versions(
  old_code: String,
  new_code: String,
  contract_id: String,
  analyzer: State<'_, AnalyzerState>,
) -> Result<DiffAnalysis, String> {
  let mut analyzer = analyzer.0.lock().map_err(|_| "Analyzer lock poisoned".to_string())?;
  let _old_report = analyzer.analyze(&old_code);
  let new_report = analyzer.analyze(&new_code);
  Ok(analyzer.compare(&contract_id, new_report))
}

