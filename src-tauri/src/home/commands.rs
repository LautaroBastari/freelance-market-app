use tauri::State;

use crate::AppState;

use super::model::AdminHomeResumen;

#[tauri::command]
pub async fn admin_home_resumen(state: State<'_, AppState>) -> Result<AdminHomeResumen, String> {
    super::repo::admin_home_resumen(&state.pool)
        .await
        .map_err(|e| e.to_string())
}
