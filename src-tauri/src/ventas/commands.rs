use tauri::State;
use sqlx::{self, Row};
use crate::AppState;

// ===== Tipos DTO mínimos (ajusta si ya los tenés en super::model) =====
#[derive(sqlx::FromRow, serde::Serialize)]
pub struct ProductoDisponible {
    pub id_producto: i64,
    pub nombre: String,
    pub precio_unitario: i64,
    pub stock_disponible: i64,
}

#[derive(sqlx::FromRow, serde::Serialize)]
pub struct VentaItemDto {
    pub id_item: i64,
    pub id_producto: i64,
    pub nombre: String,
    pub cantidad: i64,
    pub precio_unitario: i64,
    pub subtotal: i64,
}

#[derive(serde::Deserialize)]
pub struct AgregarItemInput {
    pub id_venta: i64,
    pub id_producto: i64,
    pub cantidad: i64,
}

#[derive(serde::Deserialize)]
pub struct SetCantidadInput {
    pub id_item: i64,
    pub cantidad: i64,
}

#[derive(serde::Deserialize)]
pub struct QuitarItemInput {
    pub id_item: i64,
}

// ===================== Productos =====================
#[tauri::command]
pub async fn productos_disponibles(
    state: State<'_, AppState>
) -> Result<Vec<ProductoDisponible>, String> {
    let rows = sqlx::query_as::<_, ProductoDisponible>(
        r#"
        SELECT
          p.id_producto AS id_producto,
          p.nombre      AS nombre,
          COALESCE(
            (SELECT ph.precio
               FROM precio_historial ph
              WHERE ph.id_producto = p.id_producto
                AND ph.tipo = 'venta'
                AND ph.vigente_hasta IS NULL
              ORDER BY ph.vigente_desde DESC
              LIMIT 1),
            p.precio_venta_actual
          )                          AS precio_unitario,
          COALESCE(ps.stock_actual,0) AS stock_disponible
        FROM producto p
        LEFT JOIN producto_stock ps ON ps.id_producto = p.id_producto
        WHERE p.activo = 1
        ORDER BY p.nombre
        "#
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows)
}

// ===================== Carrito (estado en_curso) =====================
// Crear cabecera en_curso y devolver id_venta
#[tauri::command]
pub async fn venta_iniciar(state: State<'_, AppState>) -> Result<i64, String> {
    let uid = *state.session_user.lock().map_err(|_| "lock")?
        .as_ref().ok_or("No hay sesión")?;

    let id_caja = sqlx::query_scalar::<_, i64>(
        "SELECT id_caja FROM caja WHERE estado='abierta' LIMIT 1"
    )
    .fetch_optional(&state.pool).await.map_err(|e| e.to_string())?
    .ok_or("No hay caja abierta")?;

    let res = sqlx::query(
        "INSERT INTO venta(id_usuario, id_caja, total, estado)
         VALUES(?, ?, 0, 'en_curso')"
    )
    .bind(uid).bind(id_caja)
    .execute(&state.pool).await.map_err(|e| e.to_string())?;

    Ok(res.last_insert_rowid())
}

// Agregar ítem (NO descuenta stock aquí)
#[tauri::command]
pub async fn venta_agregar_item(
    state: State<'_, AppState>,
    input: AgregarItemInput,
) -> Result<(), String> {
    if input.cantidad <= 0 { return Err("Cantidad inválida".into()); }

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // precio vigente (historial o catálogo)
    let precio_unitario: i64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE((
            SELECT ph.precio
              FROM precio_historial ph
             WHERE ph.id_producto = ?
               AND ph.tipo = 'venta'
               AND ph.vigente_hasta IS NULL
             ORDER BY ph.vigente_desde DESC
             LIMIT 1
        ), (SELECT p.precio_venta_actual FROM producto p WHERE p.id_producto = ?))
        "#
    )
    .bind(input.id_producto).bind(input.id_producto)
    .fetch_one(&mut *tx).await.map_err(|e| e.to_string())?;

    let subtotal = precio_unitario * input.cantidad;

    sqlx::query(
        "INSERT INTO venta_item(id_venta,id_producto,cantidad,precio_unitario,fuente_precio,subtotal)
         VALUES(?, ?, ?, ?, 'catalogo', ?)"
    )
    .bind(input.id_venta)
    .bind(input.id_producto)
    .bind(input.cantidad)
    .bind(precio_unitario)
    .bind(subtotal)
    .execute(&mut *tx).await.map_err(|e| e.to_string())?;

    // total se recalcula por triggers; por las dudas sincronizo:
    sqlx::query(
        "UPDATE venta
           SET total = (SELECT COALESCE(SUM(subtotal),0) FROM venta_item WHERE id_venta = ?)
         WHERE id_venta = ?"
    )
    .bind(input.id_venta).bind(input.id_venta)
    .execute(&mut *tx).await.map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

// Listar líneas + total
#[tauri::command]
pub async fn venta_listar(
    state: State<'_, AppState>,
    id_venta: i64,
) -> Result<(Vec<VentaItemDto>, i64), String> {
    let items = sqlx::query_as::<_, VentaItemDto>(
        r#"
        SELECT
          vi.id_item      AS id_item,
          vi.id_producto  AS id_producto,
          p.nombre        AS nombre,
          vi.cantidad     AS cantidad,
          vi.precio_unitario AS precio_unitario,
          vi.subtotal     AS subtotal
        FROM venta_item vi
        JOIN producto p ON p.id_producto = vi.id_producto
        WHERE vi.id_venta = ?
        ORDER BY vi.id_item
        "#
    )
    .bind(id_venta)
    .fetch_all(&state.pool).await.map_err(|e| e.to_string())?;

    let total: i64 = sqlx::query_scalar(
        "SELECT total FROM venta WHERE id_venta = ?"
    )
    .bind(id_venta)
    .fetch_one(&state.pool).await.map_err(|e| e.to_string())?;

    Ok((items, total))
}

// Cambiar cantidad (NO toca stock)
#[tauri::command]
pub async fn venta_set_cantidad(
    state: State<'_, AppState>,
    input: SetCantidadInput,
) -> Result<(), String> {
    if input.cantidad <= 0 { return Err("Cantidad inválida".into()); }

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // actualizar cantidad y subtotal
    sqlx::query(
        "UPDATE venta_item
            SET cantidad = ?,
                subtotal = ? * precio_unitario
          WHERE id_item = ?"
    )
    .bind(input.cantidad)
    .bind(input.cantidad)
    .bind(input.id_item)
    .execute(&mut *tx).await.map_err(|e| e.to_string())?;

    // sincronizar total de la venta (via id_venta de ese item)
    sqlx::query(
        "UPDATE venta
            SET total = (SELECT COALESCE(SUM(subtotal),0)
                           FROM venta_item
                          WHERE id_venta = (SELECT id_venta FROM venta_item WHERE id_item=?))
          WHERE id_venta = (SELECT id_venta FROM venta_item WHERE id_item=?)"
    )
    .bind(input.id_item).bind(input.id_item)
    .execute(&mut *tx).await.map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

// Quitar ítem (NO toca stock)
#[tauri::command]
pub async fn venta_quitar_item(
    state: State<'_, AppState>,
    input: QuitarItemInput,
) -> Result<(), String> {
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // Guardar id_venta para recalcular total
    let id_venta: Option<i64> = sqlx::query_scalar(
        "SELECT id_venta FROM venta_item WHERE id_item=?"
    )
    .bind(input.id_item)
    .fetch_optional(&mut *tx).await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM venta_item WHERE id_item=?")
        .bind(input.id_item)
        .execute(&mut *tx).await.map_err(|e| e.to_string())?;

    if let Some(v) = id_venta {
        sqlx::query(
            "UPDATE venta
                SET total = (SELECT COALESCE(SUM(subtotal),0) FROM venta_item WHERE id_venta=?)
              WHERE id_venta=?"
        )
        .bind(v).bind(v)
        .execute(&mut *tx).await.map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

// Cancelar carrito (marcar anulada y limpiar líneas)
#[tauri::command]
pub async fn venta_cancelar(
    state: State<'_, AppState>,
    id_venta: i64,
) -> Result<(), String> {
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM venta_item WHERE id_venta=?")
        .bind(id_venta)
        .execute(&mut *tx).await.map_err(|e| e.to_string())?;
    sqlx::query("UPDATE venta SET estado='anulada', total=0 WHERE id_venta=?")
        .bind(id_venta)
        .execute(&mut *tx).await.map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

// Finalizar: descuenta stock y registra movimientos (permite stock negativo)
#[tauri::command]
pub async fn venta_finalizar(
    state: State<'_, AppState>,
    id_venta: i64,
) -> Result<(), String> {
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // Tomo líneas
    let lineas = sqlx::query(
        "SELECT id_producto, cantidad FROM venta_item WHERE id_venta=?"
    )
    .bind(id_venta)
    .fetch_all(&mut *tx).await.map_err(|e| e.to_string())?;

    // Recalcular total por seguridad
    let total: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(subtotal),0) FROM venta_item WHERE id_venta=?"
    )
    .bind(id_venta)
    .fetch_one(&mut *tx).await.map_err(|e| e.to_string())?;

    // Descontar stock y registrar movimientos (sin guardias de no-negativo)
    for row in lineas {
        let id_producto: i64 = row.get("id_producto");
        let cantidad: i64 = row.get("cantidad");

        sqlx::query(
            "UPDATE producto_stock
                SET stock_actual = stock_actual - ?
              WHERE id_producto = ?"
        )
        .bind(cantidad).bind(id_producto)
        .execute(&mut *tx).await.map_err(|e| e.to_string())?;

        sqlx::query(
            "INSERT INTO stock_mov(id_producto, cantidad_delta, motivo, referencia)
             VALUES(?, ?, 'venta', ?)"
        )
        .bind(id_producto)
        .bind(-cantidad)
        .bind(format!("venta:{}", id_venta))
        .execute(&mut *tx).await.map_err(|e| e.to_string())?;
    }

    sqlx::query(
        "UPDATE venta SET estado='finalizada', total=? WHERE id_venta=?"
    )
    .bind(total).bind(id_venta)
    .execute(&mut *tx).await.map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}
