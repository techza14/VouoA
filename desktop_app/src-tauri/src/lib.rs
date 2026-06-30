mod bridge;
mod config;

use bridge::{fetch_decks, fetch_model_fields, fetch_models, get_snapshot, restart_bridge, save_config, start_bridge, stop_bridge, SharedState};
use config::BridgeConfig;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State, WindowEvent,
};

#[tauri::command]
fn get_app_snapshot(app: AppHandle, state: State<'_, SharedState>, force: Option<bool>) -> Result<bridge::AppSnapshot, String> {
    get_snapshot(&app, &state, force.unwrap_or(false))
}

#[tauri::command]
fn save_app_config(app: AppHandle, _state: State<'_, SharedState>, config: BridgeConfig) -> Result<BridgeConfig, String> {
    save_config(&app, &config)
}

#[tauri::command]
fn start_bridge_command(app: AppHandle, state: State<'_, SharedState>) -> Result<bridge::AppSnapshot, String> {
    start_bridge(&app, &state)?;
    get_snapshot(&app, &state, true)
}

#[tauri::command]
fn get_anki_decks() -> Result<Vec<String>, String> {
    fetch_decks()
}

#[tauri::command]
fn get_anki_models() -> Result<Vec<String>, String> {
    fetch_models()
}

#[tauri::command]
fn get_model_fields(model: String) -> Result<Vec<String>, String> {
    fetch_model_fields(&model)
}

fn show_main_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.show()?;
        window.unminimize()?;
        window.set_focus()?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let shared_state = SharedState::default();

    tauri::Builder::default()
        .manage(shared_state)
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            let _ = show_main_window(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let open_item = MenuItem::with_id(app, "open", "Open Settings", true, None::<&str>)?;
            let restart_item = MenuItem::with_id(app, "restart_bridge", "Restart Bridge", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&open_item, &restart_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    }
                    | TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } => {
                        let app = tray.app_handle();
                        let _ = show_main_window(app);
                    }
                    _ => {}
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        let _ = show_main_window(app);
                    }
                    "restart_bridge" => {
                        let state = app.state::<SharedState>();
                        let _ = restart_bridge(app, &state);
                    }
                    "quit" => {
                        let state = app.state::<SharedState>();
                        let _ = stop_bridge(app, &state);
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            let state = app.state::<SharedState>();
            let app_handle = app.handle().clone();
            let _ = start_bridge(&app_handle, &state);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_app_snapshot,
            save_app_config,
            start_bridge_command,
            get_anki_decks,
            get_anki_models,
            get_model_fields
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
