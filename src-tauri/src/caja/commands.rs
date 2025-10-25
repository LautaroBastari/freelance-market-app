use tauri::State;
use serde::{Deserialize, Serialize};
use crate::app_state::AppState;
use crate::users::auth::AuthState;
use crate::caja::repo;
#[tauri::command]
pub async fn ping_inline() -> &'static str { "pong" }

fn read_uid(auth: &AuthState, state: &AppState) -> Option<i64> {
    // 1) principal: AuthState
    if let Ok(g) = auth.current_user_id.read() {
        if g.is_some() { return *g; }
    }
    // 2) fallback: AppState.session_user (compat)
    if let Ok(g) = state.session_user.lock() {
        *g
    } else {
        None
    }
}

#[tauri::command]
pub async fn caja_esta_abierta(state: State<'_, AppState>) -> Result<bool, String> {
    repo::existe_caja_abierta(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct CajaAbrirOut { pub id_caja: i64 }

#[derive(Serialize)]
pub struct CajaCerrarOut { pub id_caja: i64 }

#[tauri::command]
pub async fn caja_abrir(state: State<'_, AppState>, auth: State<'_, AuthState>)
-> Result<CajaAbrirOut, String> {
    let uid = read_uid(&auth, &state)
        .ok_or_else(|| "Tenes que iniciar sesion para abrir caja".to_string())?;

    if repo::existe_caja_abierta(&state.pool).await.map_err(|e| e.to_string())? {
        return Err("Ya hay una caja abierta".into());
    }

    let id = repo::abrir_caja(&state.pool, uid).await.map_err(|e| e.to_string())?;
    Ok(CajaAbrirOut { id_caja: id })
}

#[tauri::command]
pub async fn caja_cerrar(state: State<'_, AppState>, auth: State<'_, AuthState>)
-> Result<CajaCerrarOut, String> {
    let uid = read_uid(&auth, &state)
        .ok_or_else(|| "Tenes que iniciar sesion para cerrar caja".to_string())?;

    let id = repo::ultima_caja_abierta_id(&state.pool)
        .await.map_err(|e| e.to_string())?
        .ok_or_else(|| "No hay caja abierta".to_string())?;

    repo::cerrar_caja(&state.pool, id, uid).await.map_err(|e| e.to_string())?;
    Ok(CajaCerrarOut { id_caja: id })
}

#[tauri::command]
pub async fn auth_logout(auth: State<'_, AuthState>) -> Result<(), String> {
    *auth.current_user_id.write().map_err(|_| "lock")? = None;
    Ok(())
}
