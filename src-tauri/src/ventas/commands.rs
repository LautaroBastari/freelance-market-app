use tauri::State;
use time::OffsetDateTime;

use crate::AppState;
use super::model::{ProductoDisponible, VentaLineaInput};



#[tauri::command]
pub async fn productos_disponibles(
    state: State<'_, AppState>
) -> Result<Vec<ProductoDisponible>, String> {
    // Notación AS "campo!: tipo" evita que SQLx piense que es Option<_>
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
          )              AS precio_unitario,
          COALESCE(ps.stock_actual, 0) AS stock_disponible
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

#[tauri::command]
pub async fn venta_registrar(
    state: State<'_, AppState>,
    lineas: Vec<VentaLineaInput>,
) -> Result<i64, String> {
    if lineas.is_empty() {
        return Err("Sin líneas".into());
    }

    let uid = *state
        .session_user
        .lock()
        .map_err(|_| "lock")?
        .as_ref()
        .ok_or("No hay sesión")?;

    let id_caja = sqlx::query_scalar::<_, i64>(
        "SELECT id_caja FROM caja WHERE estado='abierta' LIMIT 1"
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("No hay caja abierta")?;

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // Validar y calcular total (todo en INTEGER → i64)
    let mut total: i64 = 0;

    for li in &lineas {
        if li.cantidad <= 0 {
            return Err("Cantidad inválida".into());
        }

        // Precio vigente o catálogo
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
        .bind(li.id_producto)
        .bind(li.id_producto)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        // Stock actual
        let stock_actual: i64 = sqlx::query_scalar(
            "SELECT COALESCE(stock_actual,0) FROM producto_stock WHERE id_producto = ?"
        )
        .bind(li.id_producto)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        if stock_actual < li.cantidad {
            return Err(format!("Stock insuficiente en producto {}", li.id_producto));
        }

        total += precio_unitario * li.cantidad;
    }

    // Cabecera de venta
    let res = sqlx::query(
        "INSERT INTO venta(id_usuario, id_caja, total, estado) VALUES(?, ?, ?, 'finalizada')"
    )
    .bind(uid)
    .bind(id_caja)
    .bind(total)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    let id_venta = res.last_insert_rowid();

    // Líneas + stock + movimiento
    for li in &lineas {
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
        .bind(li.id_producto)
        .bind(li.id_producto)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        let subtotal: i64 = precio_unitario * li.cantidad;

        sqlx::query(
            "INSERT INTO venta_item(id_venta, id_producto, cantidad, precio_unitario, fuente_precio, subtotal)
             VALUES(?, ?, ?, ?, 'catalogo', ?)"
        )
        .bind(id_venta)
        .bind(li.id_producto)
        .bind(li.cantidad)
        .bind(precio_unitario)
        .bind(subtotal)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        // Descontar stock con guardia (no negativo)
        let updated = sqlx::query(
            "UPDATE producto_stock
               SET stock_actual = stock_actual - ?
             WHERE id_producto = ?
               AND stock_actual >= ?"
        )
        .bind(li.cantidad)
        .bind(li.id_producto)
        .bind(li.cantidad)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?
        .rows_affected();

        if updated == 0 {
            return Err(format!("Condición de stock fallida en producto {}", li.id_producto));
        }

        // Movimiento de stock
        sqlx::query(
            "INSERT INTO stock_mov(id_producto, cantidad_delta, motivo, referencia)
             VALUES(?, ?, 'venta', ?)"
        )
        .bind(li.id_producto)
        .bind(-li.cantidad) // negativo por salida
        .bind(format!("venta:{}", id_venta))
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(id_venta)
}
