use tauri::Manager;
use std::{fs, path::PathBuf, sync::{Arc, Mutex}};
use sqlx::SqlitePool;

// módulos externos (cada uno apunta a archivos/carpeta en src/)
mod app_state;
mod db;
mod users { pub mod model; pub mod crypto; pub mod repo; pub mod commands; pub mod auth; }
mod ventas;
mod caja;
mod stock;
// === Imports de estructuras expuestas ===
use app_state::AppState;
use users::auth::AuthState;
use caja::commands;
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Crear carpeta local de datos
            let data_dir: PathBuf = app
                .path()
                .app_data_dir()
                .expect("sin app_data_dir");
            fs::create_dir_all(&data_dir).expect("no se pudo crear app data dir");

            // Crear/conectar base de datos SQLite
            let db_file = data_dir.join("data.db");
            let url = format!("sqlite://{}", db_file.to_string_lossy().replace('\\', "/"));
            println!("DB en: {}", db_file.display());

            let pool = tauri::async_runtime::block_on(async {
                db::init_db(&url).await
            }).expect("falló init_db");

            // Registrar AppState en el contexto de Tauri
            app.manage(AppState {
                pool,
                session_user: Arc::new(Mutex::new(None)),
            });

            Ok(())
        })
        // Registrar AuthState global (login)
        .manage(AuthState::default())
        // Registrar comandos
        .invoke_handler(tauri::generate_handler![
            // === USUARIOS ===
            users::commands::usuario_crear,
            users::commands::usuario_obtener,
            users::commands::usuario_listar,
            users::commands::login,
            users::commands::session_info,
            users::commands::usuario_actual,
            // === VENTAS ===
            ventas::commands::productos_disponibles,
            ventas::commands::venta_registrar,

            // === CAJA ===
            caja::commands::caja_esta_abierta,
            caja::commands::caja_abrir,
            caja::commands::caja_cerrar,
            caja::commands::auth_logout,
            caja::commands::ping_inline,

            // ==== STOCK ===
            stock::commands::stock_listar,
            stock::commands::producto_crear,
            stock::commands::producto_actualizar,
            stock::commands::producto_set_activo,
            stock::commands::stock_ajustar,
            stock::commands::precio_actualizar,
            stock::commands::stock_mov_listar,
            stock::commands::precio_hist_listar,
            stock::commands::stock_fijar_absoluto,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
