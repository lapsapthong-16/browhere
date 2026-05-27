use serde::{Deserialize, Serialize};
use std::{
    env, fs, io,
    net::TcpListener,
    path::{Path, PathBuf},
    process::{Child, Command},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};
use tauri::{
    menu::{Menu, PredefinedMenuItem, Submenu},
    Emitter, Manager, Url,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[derive(Default)]
struct RuntimeState {
    child: Mutex<Option<Child>>,
    url: Mutex<Option<String>>,
    shortcut_error: Mutex<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSettings {
    gemini_api_key: String,
    groq_api_key: String,
    index_dir: String,
    shortcut: String,
    #[serde(default)]
    shortcut_registration_error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopPreferences {
    index_dir: String,
    shortcut: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct DesktopSecrets {
    gemini_api_key: String,
    groq_api_key: String,
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            gemini_api_key: String::new(),
            groq_api_key: String::new(),
            index_dir: String::new(),
            shortcut: "CommandOrControl+Shift+Space".to_string(),
            shortcut_registration_error: String::new(),
        }
    }
}

impl Default for DesktopPreferences {
    fn default() -> Self {
        Self {
            index_dir: String::new(),
            shortcut: "CommandOrControl+Shift+Space".to_string(),
        }
    }
}

#[derive(Debug, Deserialize)]
struct IndexMetadata {
    #[serde(default)]
    folders: Vec<IndexedFolder>,
}

#[derive(Debug, Deserialize)]
struct IndexedFolder {
    path: String,
}

#[tauri::command]
fn pick_folder() -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("osascript")
            .args([
                "-e",
                "POSIX path of (choose folder with prompt \"Choose a folder for Browhere to index\")",
            ])
            .output()
            .map_err(|error| error.to_string())?;

        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Ok((!path.is_empty()).then_some(path));
        }

        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("User canceled") || stderr.contains("-128") {
            return Ok(None);
        }

        return Err(stderr.trim().to_string());
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(None)
    }
}

#[tauri::command]
fn reveal_in_finder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    ensure_existing_path(&path)?;
    ensure_approved_path(&app, &path)?;
    #[cfg(target_os = "macos")]
    {
        run_open_command(["-R", path.as_str()])
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Reveal is only implemented for macOS.".to_string())
    }
}

#[tauri::command]
fn open_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    ensure_existing_path(&path)?;
    ensure_approved_path(&app, &path)?;
    #[cfg(target_os = "macos")]
    {
        run_open_command([path.as_str()])
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Open is only implemented for macOS.".to_string())
    }
}

#[tauri::command]
fn load_settings(app: tauri::AppHandle) -> Result<DesktopSettings, String> {
    let mut settings = read_settings(&settings_path(&app))?;
    if let Some(error) = app
        .state::<RuntimeState>()
        .shortcut_error
        .lock()
        .expect("shortcut error lock poisoned")
        .clone()
    {
        settings.shortcut_registration_error = error;
    }
    Ok(settings)
}

#[tauri::command]
fn save_settings(app: tauri::AppHandle, settings: DesktopSettings) -> Result<(), String> {
    let app_data = app_data_dir(&app);
    fs::create_dir_all(&app_data).map_err(|error| error.to_string())?;
    let preferences = DesktopPreferences {
        index_dir: settings.index_dir,
        shortcut: settings.shortcut,
    };
    let secrets = DesktopSecrets {
        gemini_api_key: settings.gemini_api_key,
        groq_api_key: settings.groq_api_key,
    };
    fs::write(
        settings_path(&app),
        serde_json::to_string_pretty(&preferences).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    let path = secrets_path(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(
        path,
        serde_json::to_string_pretty(&secrets).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn show_search_window(app: tauri::AppHandle) -> Result<(), String> {
    show_search(&app)
}

#[tauri::command]
fn hide_search_window(app: tauri::AppHandle) -> Result<(), String> {
    hide_search(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RuntimeState::default())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let _ = show_search(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            pick_folder,
            reveal_in_finder,
            open_path,
            load_settings,
            save_settings,
            show_search_window,
            hide_search_window
        ])
        .setup(|app| {
            install_resident_menu(app.handle())?;
            register_global_shortcuts(app.handle());
            if !cfg!(debug_assertions) {
                let url = start_next_runtime(app.handle())?;
                navigate_window(app.handle(), "main", &url)?;
                navigate_window(app.handle(), "search", &format!("{url}/search"))?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Browhere")
        .run(|app, event| match event {
            tauri::RunEvent::ExitRequested { .. } => {
                stop_next_runtime(app);
                hide_all_windows(app);
            }
            tauri::RunEvent::Exit => {
                stop_next_runtime(app);
            }
            _ => {}
        });
}

fn show_search(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("search")
        .ok_or_else(|| "Search window is not available.".to_string())?;
    window.center().map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    window
        .emit("browhere://focus-search", ())
        .map_err(|error| error.to_string())
}

fn hide_search(app: &tauri::AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window("search") else {
        return Ok(());
    };
    if window.is_visible().map_err(|error| error.to_string())? {
        window.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn hide_all_windows(app: &tauri::AppHandle) {
    for (_, window) in app.webview_windows() {
        let _ = window.hide();
    }
}

fn install_resident_menu(app: &tauri::AppHandle) -> tauri::Result<()> {
    let app_menu = Submenu::with_items(
        app,
        "Browhere",
        true,
        &[
            &PredefinedMenuItem::about(app, None, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
        ],
    )?;
    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[&PredefinedMenuItem::close_window(app, Some("Hide Window"))?],
    )?;
    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;
    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[&PredefinedMenuItem::fullscreen(app, None)?],
    )?;
    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, Some("Hide Window"))?,
        ],
    )?;
    let help_menu = Submenu::with_items(app, "Help", true, &[])?;

    app.set_menu(Menu::with_items(
        app,
        &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu, &help_menu],
    )?)?;
    Ok(())
}

fn register_global_shortcuts(app: &tauri::AppHandle) {
    let shortcut = read_settings(&settings_path(app))
        .unwrap_or_default()
        .shortcut
        .trim()
        .to_string();
    let shortcut = if shortcut.is_empty() {
        DesktopSettings::default().shortcut
    } else {
        shortcut
    };
    if let Err(error) = app.global_shortcut().register(shortcut.as_str()) {
        let message = format!("Browhere shortcut unavailable: {error}");
        eprintln!("{message}");
        *app
            .state::<RuntimeState>()
            .shortcut_error
            .lock()
            .expect("shortcut error lock poisoned") = Some(message);
    }
}

fn navigate_window(app: &tauri::AppHandle, label: &str, url: &str) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(window) = app.get_webview_window(label) {
        window.navigate(Url::parse(url)?)?;
    }
    Ok(())
}

fn start_next_runtime(app: &tauri::AppHandle) -> Result<String, Box<dyn std::error::Error>> {
    let port = reserve_port()?;
    let url = format!("http://127.0.0.1:{port}");
    let settings = read_settings(&settings_path(app)).unwrap_or_default();
    let app_data = app_data_dir(app);
    let index_dir = if settings.index_dir.trim().is_empty() {
        app_data.join("index")
    } else {
        PathBuf::from(settings.index_dir.trim())
    };
    let server_path = resolve_resource(app, ".next/standalone/server.js")?;

    let mut command = Command::new(resolve_node_executable()?);
    command
        .arg(server_path)
        .env("PORT", port.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .env("BROWHERE_DESKTOP", "1")
        .env("BROWHERE_APP_DATA_DIR", &app_data)
        .env("BROWHERE_INDEX_DIR", &index_dir);

    if !settings.gemini_api_key.trim().is_empty() {
        command.env("GEMINI_API_KEY", settings.gemini_api_key.trim());
    }
    if !settings.groq_api_key.trim().is_empty() {
        command.env("GROQ_API_KEY", settings.groq_api_key.trim());
    }

    let child = command.spawn()?;
    let state = app.state::<RuntimeState>();
    *state.child.lock().expect("runtime child lock poisoned") = Some(child);
    *state.url.lock().expect("runtime url lock poisoned") = Some(url.clone());
    wait_for_runtime(&url)?;
    Ok(url)
}

fn resolve_node_executable() -> io::Result<PathBuf> {
    if let Ok(path) = env::var("PATH") {
        if let Some(executable) = find_executable_on_path("node", &path) {
            return Ok(executable);
        }
    }

    for candidate in [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
        "/opt/local/bin/node",
    ] {
        let path = PathBuf::from(candidate);
        if path.is_file() {
            return Ok(path);
        }
    }

    Err(io::Error::new(
        io::ErrorKind::NotFound,
        "Could not find Node.js. Install Node or make it available at /opt/homebrew/bin/node or /usr/local/bin/node.",
    ))
}

fn find_executable_on_path(name: &str, path: &str) -> Option<PathBuf> {
    env::split_paths(path)
        .map(|entry| entry.join(name))
        .find(|candidate| candidate.is_file())
}

fn stop_next_runtime(app: &tauri::AppHandle) {
    let state = app.state::<RuntimeState>();
    let child = state
        .child
        .lock()
        .expect("runtime child lock poisoned")
        .take();
    if let Some(mut child) = child {
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn wait_for_runtime(url: &str) -> Result<(), Box<dyn std::error::Error>> {
    let address = url.trim_start_matches("http://");
    let started = Instant::now();
    while started.elapsed() < Duration::from_secs(20) {
        if std::net::TcpStream::connect(address).is_ok() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(150));
    }
    Err("Timed out waiting for Browhere runtime.".into())
}

fn reserve_port() -> Result<u16, std::io::Error> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

fn resolve_resource(app: &tauri::AppHandle, path: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    Ok(app.path().resolve(path, tauri::path::BaseDirectory::Resource)?)
}

fn settings_path(app: &tauri::AppHandle) -> PathBuf {
    app_data_dir(app).join("settings.json")
}

fn secrets_path(app: &tauri::AppHandle) -> PathBuf {
    app_data_dir(app).join("secrets.json")
}

fn app_data_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

fn read_settings(path: &Path) -> Result<DesktopSettings, String> {
    let app_data = path.parent().unwrap_or_else(|| Path::new("."));
    let preferences = read_preferences(path)?;
    let secrets = read_secrets(&app_data.join("secrets.json"))?;
    Ok(DesktopSettings {
        gemini_api_key: secrets.gemini_api_key,
        groq_api_key: secrets.groq_api_key,
        index_dir: preferences.index_dir,
        shortcut: preferences.shortcut,
        shortcut_registration_error: String::new(),
    })
}

fn read_preferences(path: &Path) -> Result<DesktopPreferences, String> {
    match fs::read_to_string(path) {
        Ok(payload) => {
            if let Ok(preferences) = serde_json::from_str::<DesktopPreferences>(&payload) {
                return Ok(preferences);
            }
            let legacy: DesktopSettings = serde_json::from_str(&payload).map_err(|error| error.to_string())?;
            Ok(DesktopPreferences {
                index_dir: legacy.index_dir,
                shortcut: legacy.shortcut,
            })
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(DesktopPreferences::default()),
        Err(error) => Err(error.to_string()),
    }
}

fn read_secrets(path: &Path) -> Result<DesktopSecrets, String> {
    match fs::read_to_string(path) {
        Ok(payload) => serde_json::from_str(&payload).map_err(|error| error.to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(DesktopSecrets::default()),
        Err(error) => Err(error.to_string()),
    }
}

fn ensure_existing_path(path: &str) -> Result<(), String> {
    if Path::new(path).exists() {
        Ok(())
    } else {
        Err("File path no longer exists.".to_string())
    }
}

fn ensure_approved_path(app: &tauri::AppHandle, input_path: &str) -> Result<(), String> {
    let canonical = Path::new(input_path)
        .canonicalize()
        .map_err(|_| "File path no longer exists.".to_string())?;
    let metadata_path = index_dir_for(app).join("metadata.json");
    let payload = fs::read_to_string(&metadata_path)
        .map_err(|_| "Approved folder metadata is unavailable.".to_string())?;
    let metadata: IndexMetadata = serde_json::from_str(&payload)
        .map_err(|error| format!("Approved folder metadata is invalid: {error}"))?;
    let approved = metadata.folders.iter().any(|folder| {
        Path::new(&folder.path)
            .canonicalize()
            .map(|root| is_within_folder(&canonical, &root))
            .unwrap_or(false)
    });
    if approved {
        Ok(())
    } else {
        Err("File is outside approved indexed folders.".to_string())
    }
}

fn index_dir_for(app: &tauri::AppHandle) -> PathBuf {
    let settings = read_settings(&settings_path(app)).unwrap_or_default();
    if settings.index_dir.trim().is_empty() {
        app_data_dir(app).join("index")
    } else {
        PathBuf::from(settings.index_dir.trim())
    }
}

fn is_within_folder(file_path: &Path, folder_path: &Path) -> bool {
    file_path == folder_path || file_path.starts_with(folder_path)
}

#[cfg(target_os = "macos")]
fn run_open_command<const N: usize>(args: [&str; N]) -> Result<(), String> {
    let status = Command::new("open")
        .args(args)
        .status()
        .map_err(|error| error.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("macOS open command failed.".to_string())
    }
}
