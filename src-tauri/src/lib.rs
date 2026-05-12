mod file_actions;
mod search_engine;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(search_engine::SearchEngineState::default())
        .invoke_handler(tauri::generate_handler![
            file_actions::open_file,
            file_actions::reveal_in_folder,
            search_engine::get_settings,
            search_engine::save_ai_settings,
            search_engine::clear_api_key,
            search_engine::test_ai_provider,
            search_engine::get_index_status,
            search_engine::get_index_errors,
            search_engine::get_runtime_config_status,
            search_engine::get_folder_file_status,
            search_engine::get_file_index_status,
            search_engine::add_index_folder,
            search_engine::remove_index_folder,
            search_engine::cancel_indexing,
            search_engine::start_indexing,
            search_engine::search_files
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Browhere desktop search shell");
}
