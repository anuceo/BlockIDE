use serde::Serialize;
use std::io::Write;
use std::process::{Command, Stdio};
use tempfile::Builder;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SecurityError {
  #[error("IO error: {0}")]
  Io(#[from] std::io::Error),
  #[error("JSON error: {0}")]
  Json(#[from] serde_json::Error),
  #[error("Tool not found: {0}")]
  ToolNotFound(String),
  #[error("Analysis failed: {0}")]
  AnalysisFailed(String),
}

#[derive(Serialize, Clone, Debug)]
pub struct Vulnerability {
  pub severity: String,
  pub category: String,
  pub title: String,
  pub description: String,
  pub recommendation: String,
  pub line_start: Option<u32>,
  pub line_end: Option<u32>,
  pub swc_id: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct SecurityReport {
  pub tool: String,
  pub version: String,
  pub vulnerabilities: Vec<Vulnerability>,
  pub summary: SecuritySummary,
  pub passed: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct SecuritySummary {
  pub high: u32,
  pub medium: u32,
  pub low: u32,
  pub informational: u32,
  pub total: u32,
}

#[tauri::command]
pub async fn analyze_security(code: String, tools: Vec<String>) -> Result<Vec<SecurityReport>, String> {
  let mut reports = Vec::new();

  // Create temporary Solidity file (needs .sol suffix for many tools)
  let mut temp_file = Builder::new()
    .prefix("contract_")
    .suffix(".sol")
    .tempfile()
    .map_err(|e| format!("Failed to create temp file: {e}"))?;

  temp_file
    .write_all(code.as_bytes())
    .map_err(|e| format!("Failed to write to temp file: {e}"))?;

  let file_path = temp_file
    .path()
    .to_str()
    .ok_or("Invalid file path")?
    .to_string();

  for tool in tools {
    let report = match tool.as_str() {
      "slither" => run_slither(&file_path).await,
      "mythril" => run_mythril(&file_path).await,
      "solhint" => run_solhint(&file_path).await,
      _ => Err(SecurityError::AnalysisFailed(format!("Unknown tool: {tool}"))),
    };

    match report {
      Ok(r) => reports.push(r),
      Err(e) => {
        // Don’t fail the whole request; return a report explaining the failure.
        reports.push(error_report(tool, &e));
      }
    }
  }

  Ok(reports)
}

fn empty_summary() -> SecuritySummary {
  SecuritySummary {
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
    total: 0,
  }
}

fn error_report(tool: String, err: &SecurityError) -> SecurityReport {
  let mut summary = empty_summary();
  summary.informational = 1;
  summary.total = 1;

  SecurityReport {
    tool: tool.clone(),
    version: "Unknown".to_string(),
    vulnerabilities: vec![Vulnerability {
      severity: "informational".to_string(),
      category: "tooling".to_string(),
      title: format!("{tool} unavailable"),
      description: err.to_string(),
      recommendation: format!("Install and ensure `{tool}` is on PATH."),
      line_start: None,
      line_end: None,
      swc_id: None,
    }],
    summary,
    passed: false,
  }
}

fn check_tool(cmd: &str, version_arg: &str) -> Result<String, SecurityError> {
  let out = Command::new(cmd).arg(version_arg).output();
  match out {
    Ok(out) if out.status.success() => Ok(String::from_utf8_lossy(&out.stdout).trim().to_string()),
    Ok(_) => Err(SecurityError::ToolNotFound(cmd.to_string())),
    Err(_) => Err(SecurityError::ToolNotFound(cmd.to_string())),
  }
}

async fn run_slither(file_path: &str) -> Result<SecurityReport, SecurityError> {
  let version = check_tool("slither", "--version")?;

  let output = Command::new("slither")
    .arg(file_path)
    .arg("--json")
    .arg("-")
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .output()
    .map_err(|e| SecurityError::AnalysisFailed(format!("Slither execution failed: {e}")))?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    return Err(SecurityError::AnalysisFailed(format!("Slither analysis failed: {stderr}")));
  }

  let stdout = String::from_utf8_lossy(&output.stdout);
  let json: serde_json::Value = serde_json::from_str(&stdout)?;

  let mut vulnerabilities = Vec::new();
  let mut summary = empty_summary();

  if let Some(detectors) = json
    .get("results")
    .and_then(|r| r.get("detectors"))
    .and_then(|d| d.as_array())
  {
    for detector in detectors {
      let impact = detector.get("impact").and_then(|v| v.as_str()).unwrap_or("Informational");
      let confidence = detector
        .get("confidence")
        .and_then(|v| v.as_str())
        .unwrap_or("Medium");

      let severity = match (impact, confidence) {
        ("High", _) => "high",
        ("Medium", "High") => "high",
        ("Medium", _) => "medium",
        ("Low", "High") => "medium",
        ("Low", _) => "low",
        _ => "informational",
      };

      match severity {
        "high" => summary.high += 1,
        "medium" => summary.medium += 1,
        "low" => summary.low += 1,
        _ => summary.informational += 1,
      }

      let check = detector.get("check").and_then(|v| v.as_str()).unwrap_or("Unknown");
      let desc = detector
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

      // Try a few common locations for line info.
      let line_start = detector
        .get("first_mark")
        .and_then(|m| m.get("line"))
        .and_then(|n| n.as_u64())
        .or_else(|| detector.get("first_mark").and_then(|m| m.get("line_number")).and_then(|n| n.as_u64()))
        .map(|n| n as u32);
      let line_end = detector
        .get("second_mark")
        .and_then(|m| m.get("line"))
        .and_then(|n| n.as_u64())
        .or_else(|| detector.get("second_mark").and_then(|m| m.get("line_number")).and_then(|n| n.as_u64()))
        .map(|n| n as u32);

      vulnerabilities.push(Vulnerability {
        severity: severity.to_string(),
        category: check.to_string(),
        title: check.to_string(),
        description: desc,
        recommendation: detector
          .get("exploit_scenario")
          .and_then(|v| v.as_str())
          .unwrap_or("Review and remediate this finding.")
          .to_string(),
        line_start,
        line_end,
        swc_id: detector.get("swc_id").and_then(|v| v.as_str()).map(|s| s.to_string()),
      });
    }
  }

  summary.total = vulnerabilities.len() as u32;

  Ok(SecurityReport {
    tool: "slither".to_string(),
    version,
    vulnerabilities,
    passed: summary.high == 0 && summary.medium == 0,
    summary,
  })
}

async fn run_mythril(file_path: &str) -> Result<SecurityReport, SecurityError> {
  let version = check_tool("myth", "--version")?;

  // Prefer JSON output if available; fall back to text parsing.
  let output = Command::new("myth")
    .arg("analyze")
    .arg(file_path)
    .arg("--execution-timeout")
    .arg("60")
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .output()
    .map_err(|e| SecurityError::AnalysisFailed(format!("Mythril execution failed: {e}")))?;

  let stdout = String::from_utf8_lossy(&output.stdout);
  let stderr = String::from_utf8_lossy(&output.stderr);

  if !output.status.success() && stdout.is_empty() {
    return Err(SecurityError::AnalysisFailed(format!("Mythril failed: {stderr}")));
  }

  let mut vulnerabilities = Vec::new();
  let mut summary = empty_summary();

  for line in stdout.lines().chain(stderr.lines()) {
    if !line.contains("SWC-") && !line.contains("Severity:") {
      continue;
    }
    let severity = if line.contains("Severity: High") {
      "high"
    } else if line.contains("Severity: Medium") {
      "medium"
    } else if line.contains("Severity: Low") {
      "low"
    } else {
      "informational"
    };

    match severity {
      "high" => summary.high += 1,
      "medium" => summary.medium += 1,
      "low" => summary.low += 1,
      _ => summary.informational += 1,
    }

    vulnerabilities.push(Vulnerability {
      severity: severity.to_string(),
      category: "symbolic-execution".to_string(),
      title: extract_title(line),
      description: line.to_string(),
      recommendation: "Review the code and confirm exploitability.".to_string(),
      line_start: None,
      line_end: None,
      swc_id: extract_swc_id(line),
    });
  }

  summary.total = vulnerabilities.len() as u32;

  Ok(SecurityReport {
    tool: "mythril".to_string(),
    version,
    vulnerabilities,
    passed: summary.high == 0 && summary.medium == 0,
    summary,
  })
}

async fn run_solhint(file_path: &str) -> Result<SecurityReport, SecurityError> {
  let version = check_tool("solhint", "--version")?;

  let output = Command::new("solhint")
    .arg(file_path)
    .arg("--formatter")
    .arg("json")
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .output()
    .map_err(|e| SecurityError::AnalysisFailed(format!("Solhint execution failed: {e}")))?;

  // solhint can return non-zero when issues exist; still parse stdout.
  let stdout = String::from_utf8_lossy(&output.stdout);
  let json: serde_json::Value = serde_json::from_str(&stdout).unwrap_or_else(|_| serde_json::Value::Null);

  let mut vulnerabilities = Vec::new();
  let mut summary = empty_summary();

  if let Some(reports) = json.as_array() {
    for report in reports {
      if let Some(issues) = report.get("messages").and_then(|m| m.as_array()) {
        for issue in issues {
          let sev_num = issue.get("severity").and_then(|n| n.as_u64()).unwrap_or(1);
          let severity = match sev_num {
            2 => "high",
            1 => "medium",
            _ => "informational",
          };

          match severity {
            "high" => summary.high += 1,
            "medium" => summary.medium += 1,
            "low" => summary.low += 1,
            _ => summary.informational += 1,
          }

          vulnerabilities.push(Vulnerability {
            severity: severity.to_string(),
            category: issue.get("ruleId").and_then(|v| v.as_str()).unwrap_or("solhint").to_string(),
            title: issue.get("message").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            description: issue.get("message").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            recommendation: "Follow Solidity best practices and address the rule.".to_string(),
            line_start: issue.get("line").and_then(|n| n.as_u64()).map(|n| n as u32),
            line_end: issue.get("endLine").and_then(|n| n.as_u64()).map(|n| n as u32),
            swc_id: None,
          });
        }
      }
    }
  }

  summary.total = vulnerabilities.len() as u32;

  Ok(SecurityReport {
    tool: "solhint".to_string(),
    version,
    vulnerabilities,
    passed: summary.high == 0 && summary.medium == 0,
    summary,
  })
}

fn extract_title(line: &str) -> String {
  if let Some(start) = line.find("Title:") {
    let rest = &line[start + 6..];
    if let Some(end) = rest.find('.') {
      return rest[..end].trim().to_string();
    }
    return rest.trim().to_string();
  }
  "Unknown vulnerability".to_string()
}

fn extract_swc_id(line: &str) -> Option<String> {
  if let Some(start) = line.find("SWC-") {
    let rest = &line[start..];
    if let Some(end) = rest.find(' ') {
      return Some(rest[..end].to_string());
    }
    return Some(rest.to_string());
  }
  None
}

