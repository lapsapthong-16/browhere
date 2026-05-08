mod file_actions;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            file_actions::open_file,
            file_actions::reveal_in_folder
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Browhere desktop search shell");
}
