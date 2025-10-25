use tauri::State;
use crate::AppState;
use super::auth::AuthState; // <-- tu módulo de auth con current_user_id
// use sqlx::Row; // innecesario

#[tauri::command]
pub async fn ping_inline() -> &'static str { "pong" }


#[tauri::command]
pub async fn caja_esta_abierta(state: State<'_, AppState>) -> Result<bool, String> {
    let ok: Option<i64> = sqlx::query_scalar("SELECT 1 FROM caja WHERE estado='abierta' LIMIT 1")
        .fetch_optional(&state.pool).await.map_err(|e| e.to_string())?;
    Ok(ok.is_some())
}

#[tauri::command]
pub async fn caja_abrir(state: State<'_, AppState>, auth: State<'_, AuthState>) -> Result<i64, String> {
    let uid = auth.current_user_id.read().map_err(|_| "lock")?
        .ok_or_else(|| "no login".to_string())?;

    // evitar duplicado de caja abierta
    let ya_abierta: Option<i64> = sqlx::query_scalar("SELECT 1 FROM caja WHERE estado='abierta' LIMIT 1")
        .fetch_optional(&state.pool).await.map_err(|e| e.to_string())?;
    if ya_abierta.is_some() {
        return Err("Ya hay una caja abierta".into());
    }

    let res = sqlx::query("INSERT INTO caja (abierta_por, estado, abierta_en) VALUES (?1,'abierta',CURRENT_TIMESTAMP)")
        .bind(uid)
        .execute(&state.pool).await.map_err(|e| e.to_string())?;

    Ok(res.last_insert_rowid())
}

#[tauri::command]
pub async fn caja_cerrar(state: State<'_, AppState>, auth: State<'_, AuthState>) -> Result<i64, String> {
    let uid = auth.current_user_id.read().map_err(|_| "lock")?
        .ok_or_else(|| "no login".to_string())?;

    let id_caja: Option<i64> = sqlx::query_scalar(
        "SELECT id_caja FROM caja WHERE estado='abierta' ORDER BY id_caja DESC LIMIT 1"
    ).fetch_optional(&state.pool).await.map_err(|e| e.to_string())?;

    let Some(id) = id_caja else { return Err("No hay caja abierta".into()); };

    sqlx::query(
        "UPDATE caja
           SET estado='cerrada',
               cerrada_en=CURRENT_TIMESTAMP,
               cerrada_por=?1
         WHERE id_caja=?2 AND estado='abierta'"
    )
    .bind(uid)
    .bind(id)
    .execute(&state.pool).await.map_err(|e| e.to_string())?;

    Ok(id)
}

#[tauri::command]
pub async fn auth_logout(auth: State<'_, AuthState>) -> Result<(), String> {
    *auth.current_user_id.write().map_err(|_| "lock")? = None;
    Ok(())
}
