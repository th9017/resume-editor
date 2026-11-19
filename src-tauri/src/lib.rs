use tauri_plugin_fs::FsExt;

#[tauri::command]
fn exe_dir() -> Option<String> {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|dir| dir.to_string_lossy().into_owned()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if let Some(dir) = std::env::current_exe()?.parent() {
                let _ = app.fs_scope().allow_directory(dir, true);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![exe_dir])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
