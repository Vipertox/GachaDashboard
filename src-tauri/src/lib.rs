mod hoyolab_login;
mod launcher;

#[tauri::command]
fn read_kuro_launcher_code() -> Result<String, String> {
    launcher::read_code()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_secure_keystore::init())
        .plugin(tauri_plugin_opener::init());
    // Selbst-Update nur auf dem Desktop
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());
    builder
        .invoke_handler(tauri::generate_handler![
            read_kuro_launcher_code,
            hoyolab_login::hoyolab_webview_login
        ])
        .run(tauri::generate_context!())
        .expect("Fehler beim Start der App");
}
