use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileActionBridgeResult {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<FileActionError>,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum FileActionError {
    NotFound { message: String },
    OsFailure { message: String },
}

#[tauri::command]
pub fn open_file(file_path: String) -> FileActionBridgeResult {
    if !Path::new(&file_path).is_file() {
        return not_found();
    }

    run_os_command(open_file_command(&file_path))
}

#[tauri::command]
pub fn reveal_in_folder(file_path: String) -> FileActionBridgeResult {
    if !Path::new(&file_path).exists() {
        return not_found();
    }

    run_os_command(reveal_in_folder_command(&file_path))
}

fn run_os_command(mut command: Command) -> FileActionBridgeResult {
    match command.status() {
        Ok(status) if status.success() => FileActionBridgeResult {
            ok: true,
            error: None,
        },
        Ok(status) => os_failure(format!(
            "The operating system action failed with status {status}."
        )),
        Err(error) => os_failure(error.to_string()),
    }
}

#[cfg(target_os = "windows")]
fn open_file_command(file_path: &str) -> Command {
    let mut command = Command::new("cmd");
    command.args(["/C", "start", "", file_path]);
    command
}

#[cfg(target_os = "windows")]
fn reveal_in_folder_command(file_path: &str) -> Command {
    let mut command = Command::new("explorer");
    command.arg(format!("/select,{file_path}"));
    command
}

#[cfg(target_os = "macos")]
fn open_file_command(file_path: &str) -> Command {
    let mut command = Command::new("open");
    command.arg(file_path);
    command
}

#[cfg(target_os = "macos")]
fn reveal_in_folder_command(file_path: &str) -> Command {
    let mut command = Command::new("open");
    command.args(["-R", file_path]);
    command
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_file_command(file_path: &str) -> Command {
    let mut command = Command::new("xdg-open");
    command.arg(file_path);
    command
}

#[cfg(all(unix, not(target_os = "macos")))]
fn reveal_in_folder_command(file_path: &str) -> Command {
    let mut command = Command::new("xdg-open");
    command.arg(
        Path::new(file_path)
            .parent()
            .unwrap_or_else(|| Path::new(file_path)),
    );
    command
}

fn not_found() -> FileActionBridgeResult {
    FileActionBridgeResult {
        ok: false,
        error: Some(FileActionError::NotFound {
            message: "The file could not be accessed.".to_string(),
        }),
    }
}

fn os_failure(message: String) -> FileActionBridgeResult {
    FileActionBridgeResult {
        ok: false,
        error: Some(FileActionError::OsFailure { message }),
    }
}
