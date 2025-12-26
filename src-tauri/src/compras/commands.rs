use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn registrar_compra(
    state: State<'_, AppState>,
    idProducto: i64,
    cantidad: i64,
    costoUnitario: i64,
    referencia: Option<String>,
    mantenerCosto: bool,
) -> Result<(), String> {
    if cantidad <= 0 {
        return Err("La cantidad debe ser positiva".into());
    }

    let pool = &state.pool;

    crate::compras::repo::registrar_compra_repo(
        pool,
        idProducto,
        cantidad,
        costoUnitario,
        referencia,
        mantenerCosto,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}
