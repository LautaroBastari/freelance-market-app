use tauri::Manager;
use std::sync::{Arc, Mutex};

// módulos externos
mod app_state;
mod db;
mod users { pub mod model; pub mod crypto; pub mod repo; pub mod commands; pub mod auth; }
mod ventas;
mod caja;
mod stock;

// === Imports de estructuras expuestas ===
use app_state::AppState;
use users::auth::AuthState;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // 1) Obtené el AppHandle
            let handle = app.handle();

            // 2) Inicializá la BD usando el AppHandle (db.rs resuelve la URL y corre migraciones)
            let pool = tauri::async_runtime::block_on(async {
                db::init_db(&handle).await
            }).expect("falló init_db");

            // 3) Registrar AppState en el contexto de Tauri
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
            ventas::commands::venta_iniciar,
            ventas::commands::venta_agregar_item,
            ventas::commands::venta_listar,
            ventas::commands::venta_set_cantidad,
            ventas::commands::venta_quitar_item,
            ventas::commands::venta_cancelar,
            ventas::commands::venta_finalizar,
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
            
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
