use serde::{Deserialize, Serialize};
use tauri::State;
use sqlx::FromRow;
use crate::AppState;

#[derive(Debug, Serialize, FromRow)]
pub struct ProductoBasico {
    pub id_producto: i64,
    pub codigo_producto: String,
    pub nombre: String,
    pub precio_venta_actual: i64,
    pub costo_actual: i64,
}

#[derive(Debug, Deserialize)]
pub struct VentaEditarItemInput {
    pub id_producto: i64,
    pub cantidad: i64,
    pub precio_unitario: i64,
    pub costo_unitario_en_venta: Option<i64>, // si viene None => usa costo_actual
    pub fuente_precio: String, // 'catalogo' | 'manual' | 'promo'
}

#[derive(Debug, Deserialize)]
pub struct VentaEditarPagoInput {
    pub medio: String, // 'efectivo' | 'debito' | 'credito' | 'transferencia'
    pub monto: i64,
    pub referencia: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct VentaEditarGuardarInput {
    pub id_venta: i64,
    pub items: Vec<VentaEditarItemInput>,
    pub pagos: Vec<VentaEditarPagoInput>,
}

#[tauri::command]
pub async fn producto_listar_basico(
    state: State<'_, AppState>,
    q: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<ProductoBasico>, String> {
    let pool = &state.pool;
    let q = q.unwrap_or_default();
    let limit = limit.unwrap_or(50).clamp(1, 200);

    let like = format!("%{}%", q.trim());

    let rows = sqlx::query_as::<_, ProductoBasico>(
        r#"
        SELECT id_producto, codigo_producto, nombre, precio_venta_actual, costo_actual
        FROM producto
        WHERE activo = 1
          AND (codigo_producto LIKE ? OR nombre LIKE ?)
        ORDER BY nombre ASC
        LIMIT ?;
        "#
    )
    .bind(&like)
    .bind(&like)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("producto_listar_basico: {e}"))?;

    Ok(rows)
}


#[tauri::command]
pub async fn venta_admin_editar_guardar(
    state: State<'_, AppState>,
    input: VentaEditarGuardarInput,
) -> Result<(), String> {
    let pool = &state.pool;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    // Validaciones mínimas
    if input.items.is_empty() {
        return Err("La venta no puede quedar sin items.".into());
    }
    for it in &input.items {
        if it.cantidad <= 0 {
            return Err("Cantidad inválida.".into());
        }
        if it.precio_unitario < 0 {
            return Err("Precio inválido.".into());
        }
        if let Some(c) = it.costo_unitario_en_venta {
            if c < 0 {
                return Err("Costo inválido.".into());
            }
        }
    }
    for p in &input.pagos {
        if p.monto <= 0 {
            return Err("Monto de pago inválido.".into());
        }
    }

    //bloquear edición
    let res = sqlx::query(
        r#"
        UPDATE venta
        SET estado = 'en_curso'
        WHERE id_venta = ?
          AND estado = 'finalizada';
        "#,
    )
    .bind(input.id_venta)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("set en_curso: {e}"))?;

    if res.rows_affected() != 1 {
        // Si no afectó 1 fila, no estaba en finalizada (o no existe)
        return Err("No se puede editar: la venta no está en estado 'finalizada'.".into());
    }

    // Reemplazar items
    sqlx::query("DELETE FROM venta_item WHERE id_venta = ?;")
        .bind(input.id_venta)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("delete items: {e}"))?;

    for it in input.items {
        let costo = match it.costo_unitario_en_venta {
            Some(v) => v,
            None => {
                let row = sqlx::query_scalar::<_, i64>(
                    "SELECT costo_actual FROM producto WHERE id_producto = ?;",
                )
                .bind(it.id_producto)
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| format!("costo_actual producto {}: {e}", it.id_producto))?;
                row
            }
        };

        sqlx::query(
            r#"
            INSERT INTO venta_item(
              id_venta, id_producto, cantidad,
              precio_unitario, costo_unitario_en_venta,
              fuente_precio, subtotal
            )
            VALUES (?, ?, ?, ?, ?, ?, 0);
            "#,
        )
        .bind(input.id_venta)
        .bind(it.id_producto)
        .bind(it.cantidad)
        .bind(it.precio_unitario)
        .bind(costo)
        .bind(it.fuente_precio)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("insert item: {e}"))?;
        // subtotal/total por triggers
    }

    // Reemplazar pagos
    sqlx::query("DELETE FROM venta_pago WHERE id_venta = ?;")
        .bind(input.id_venta)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("delete pagos: {e}"))?;

    for p in input.pagos {
        sqlx::query(
            r#"
            INSERT INTO venta_pago(id_venta, medio, monto, referencia)
            VALUES (?, ?, ?, ?);
            "#,
        )
        .bind(input.id_venta)
        .bind(p.medio)
        .bind(p.monto)
        .bind(p.referencia)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("insert pago: {e}"))?;
    }

    // Finalizar SOLO si está en_curso
    let res = sqlx::query(
        r#"
        UPDATE venta
        SET estado = 'finalizada'
        WHERE id_venta = ?
          AND estado = 'en_curso';
        "#,
    )
    .bind(input.id_venta)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("finalizar venta: {e}"))?;

    if res.rows_affected() != 1 {
        return Err("No se pudo finalizar: la venta no estaba en 'en_curso'.".into());
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}