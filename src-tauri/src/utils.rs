use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkStatus {
    pub online: bool,
    pub timestamp: i64,
}

#[tauri::command]
pub async fn get_network_status() -> Result<NetworkStatus, String> {
    Ok(NetworkStatus {
        online: true,
        timestamp: chrono::Utc::now().timestamp(),
    })
}

#[tauri::command]
pub async fn check_wallet_connection() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "connected": false, "stub": true }))
}

fn workspace_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app_data_dir: {}", e))?;
    Ok(base.join("workspace"))
}

fn ensure_parent(path: &Path) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn save_file(app: tauri::AppHandle, path: String, content: String) -> Result<(), String> {
    let root = workspace_root(&app)?;
    let full = root.join(path);
    ensure_parent(&full).map_err(|e| format!("Failed to create directory: {}", e))?;
    fs::write(full, content).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn load_file(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let root = workspace_root(&app)?;
    let full = root.join(path);
    fs::read_to_string(full).map_err(|e| format!("Failed to read file: {}", e))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub content: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub size: Option<u64>,
    pub modified: Option<i64>,
}

fn list_files_recursive(root: &Path, current: &Path) -> Result<Vec<FileInfo>, io::Error> {
    let mut out = Vec::new();
    if !current.exists() {
        return Ok(out);
    }

    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();
        let meta = entry.metadata()?;

        if meta.is_dir() {
            out.extend(list_files_recursive(root, &path)?);
            continue;
        }

        let rel = path.strip_prefix(root).unwrap_or(&path);
        let rel_str = rel.to_string_lossy().replace('\\', "/");
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        let content = fs::read_to_string(&path).unwrap_or_default();
        let modified = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64);

        out.push(FileInfo {
            name,
            path: rel_str,
            content,
            file_type: "file".to_string(),
            size: Some(meta.len()),
            modified,
        });
    }

    Ok(out)
}

#[tauri::command]
pub async fn list_files(app: tauri::AppHandle, directory: Option<String>) -> Result<Vec<FileInfo>, String> {
    let root = workspace_root(&app)?;
    fs::create_dir_all(&root).map_err(|e| format!("Failed to ensure workspace dir: {}", e))?;
    let dir = match directory {
        Some(d) if !d.is_empty() => root.join(d),
        _ => root.clone(),
    };
    list_files_recursive(&root, &dir).map_err(|e| format!("Failed to list files: {}", e))
}

