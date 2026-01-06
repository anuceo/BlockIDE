use serde::{Deserialize, Serialize};

#[derive(Default)]
pub struct DifferentialAnalyzer {}

impl DifferentialAnalyzer {
    pub fn new() -> Self {
        Self::default()
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityFinding {
    pub id: String,
    pub severity: String,
    pub title: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityAnalysisResult {
    pub findings: Vec<SecurityFinding>,
    pub summary: serde_json::Value,
}

#[tauri::command]
pub async fn analyze_security(code: String) -> Result<SecurityAnalysisResult, String> {
    // Stub: real implementation would run multiple tools and compare.
    let mut findings = Vec::new();
    if code.contains("tx.origin") {
        findings.push(SecurityFinding {
            id: "tx-origin".to_string(),
            severity: "medium".to_string(),
            title: "Use of tx.origin".to_string(),
            description: "tx.origin is dangerous for auth checks".to_string(),
        });
    }
    Ok(SecurityAnalysisResult {
        findings,
        summary: serde_json::json!({ "stub": true }),
    })
}

#[tauri::command]
pub async fn compare_versions(old_code: String, new_code: String) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "changed": old_code != new_code,
        "stub": true
    }))
}

