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
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, ShortcutState};

#[derive(Default)]
struct RuntimeState {
    child: Mutex<Option<Child>>,
    url: Mutex<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSettings {
    gemini_api_key: String,
    groq_api_key: String,
    index_dir: String,
    shortcut: String,
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            gemini_api_key: String::new(),
            groq_api_key: String::new(),
            index_dir: String::new(),
            shortcut: "CommandOrControl+Shift+Space".to_string(),
        }
    }
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
fn reveal_in_finder(path: String) -> Result<(), String> {
    ensure_existing_path(&path)?;
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
fn open_path(path: String) -> Result<(), String> {
    ensure_existing_path(&path)?;
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
    read_settings(&settings_path(&app))
}

#[tauri::command]
fn save_settings(app: tauri::AppHandle, settings: DesktopSettings) -> Result<(), String> {
    let path = settings_path(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_string_pretty(&settings).map_err(|error| error.to_string())?;
    fs::write(path, payload).map_err(|error| error.to_string())
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
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        if shortcut.key == Code::Escape {
                            let _ = hide_search(app);
                        } else {
                            let _ = show_search(app);
                        }
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
            tauri::RunEvent::ExitRequested { api, .. } => {
                api.prevent_exit();
                hide_all_windows(app);
            }
            tauri::RunEvent::Exit => stop_next_runtime(app),
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
    if let Err(error) = app.global_shortcut().register("CommandOrControl+Shift+Space") {
        eprintln!("Browhere shortcut unavailable: {error}");
    }
    if let Err(error) = app.global_shortcut().register("Escape") {
        eprintln!("Browhere Escape shortcut unavailable: {error}");
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

fn app_data_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

fn read_settings(path: &Path) -> Result<DesktopSettings, String> {
    match fs::read_to_string(path) {
        Ok(payload) => serde_json::from_str(&payload).map_err(|error| error.to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(DesktopSettings::default()),
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
