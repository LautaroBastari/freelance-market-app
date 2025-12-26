use tauri::State;

use crate::AppState;
use crate::promos::{model::*, repo};

#[tauri::command(rename = "promo_combo_crear")]
pub async fn promo_combo_crear(
    state: State<'_, AppState>,
    input: PromoComboCrearInput,
) -> Result<i64, String> {
    repo::promo_combo_crear_db(&state.pool, input).await
}

#[tauri::command(rename = "promo_combo_listar")]
pub async fn promo_combo_listar(
    state: State<'_, AppState>,
) -> Result<Vec<PromoComboRow>, String> {
    repo::promo_combo_listar_db(&state.pool).await
}

#[tauri::command(rename = "promo_combo_detalle")]
pub async fn promo_combo_detalle(
    state: State<'_, AppState>,
    id_combo: i64,
) -> Result<PromoComboDetalle, String> {
    repo::promo_combo_detalle_db(&state.pool, id_combo).await
}


#[tauri::command(rename = "promo_combo_eliminar")]
pub async fn promo_combo_eliminar(
    state: tauri::State<'_, crate::AppState>,
    id_combo: i64,
) -> Result<(), String> {
    let pool = &state.pool;

    let res = sqlx::query(
        "UPDATE promo_combo SET activo = 0 WHERE id_combo = ?"
    )
    .bind(id_combo)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    if res.rows_affected() == 0 {
        return Err("Combo no encontrado.".to_string());
    }

    Ok(())
}