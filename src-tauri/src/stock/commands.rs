use tauri::State;
use serde::{Serialize, Deserialize};
use crate::app_state::AppState;
use crate::stock::repo::{self, TipoPrecio};
use sqlx::Row;
use sqlx::Error as SqlxError;
/* ===== Listar / Buscar ===== */
#[derive(Serialize)]
pub struct StockResumen {
    pub id_producto: i64,
    pub codigo: String,
    pub nombre: String,
    pub stock_actual: i64,
    pub precio_venta_actual: i64,
    pub costo_actual: i64,
}

#[tauri::command]
pub fn stock_listar(
    state: tauri::State<'_, crate::app_state::AppState>,
    q: Option<String>,
    solo_activos: Option<bool>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<crate::stock::commands::StockResumen>, String> {
    let q = q.unwrap_or_default();
    let solo_activos = solo_activos.unwrap_or(true);
    let limit = limit.unwrap_or(200).max(1);
    let offset = offset.unwrap_or(0).max(0);

    let rows = tauri::async_runtime::block_on(async move {
        sqlx::query(
            r#"
            SELECT p.id_producto,
                   p.codigo_producto,
                   p.nombre,
                   COALESCE(ps.stock_actual, 0)            AS stock_actual,
                   p.precio_venta_actual,
                   p.costo_actual
            FROM producto p
            LEFT JOIN producto_stock ps USING(id_producto)
            WHERE (?1 = '' OR p.nombre LIKE '%'||?1||'%' OR p.codigo_producto LIKE '%'||?1||'%')
              AND (?2 = 0 OR p.activo = 1)
            ORDER BY p.id_producto ASC
            LIMIT ?3 OFFSET ?4
            "#
        )
        .bind(&q)
        .bind(if solo_activos { 1 } else { 0 })
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pool)
        .await
    }).map_err(|e| e.to_string())?;

    let out = rows.into_iter().map(|r| crate::stock::commands::StockResumen{
        id_producto:        r.get::<i64, _>(0),
        codigo:             r.get::<String, _>(1),
        nombre:             r.get::<String, _>(2),
        stock_actual:       r.get::<i64, _>(3),
        precio_venta_actual:r.get::<i64, _>(4),
        costo_actual:       r.get::<i64, _>(5),
    }).collect();

    Ok(out)
}

/* ===== Crear producto ===== */
#[derive(Deserialize)]
pub struct ProductoCrearIn {
    pub codigo: String,
    pub nombre: String,
    pub precio_venta: i64,
    pub costo: i64,
}
#[derive(Serialize)]
pub struct ProductoIdOut { pub id_producto: i64 }

#[tauri::command]
pub async fn producto_crear(
    state: State<'_, AppState>,
    input: ProductoCrearIn
) -> Result<ProductoIdOut, String> {
    let res = crate::stock::repo::producto_crear(
        &state.pool, &input.codigo, &input.nombre, input.precio_venta, input.costo
    ).await;

    match res {
        Ok(id) => Ok(ProductoIdOut { id_producto: id }),
        Err(e) => {
            // e es anyhow::Error → intento obtener referencia a sqlx::Error
            if let Some(db_err) = e.downcast_ref::<SqlxError>() {
                if let SqlxError::Database(db) = db_err {
                    let msg = db.message();
                    // SQLite: 2067 = UNIQUE constraint failed
                    let code_is_unique = db.code().as_deref() == Some("2067");
                    let is_codigo = msg.contains("producto.codigo_producto");
                    if code_is_unique && is_codigo
                        || msg.contains("UNIQUE constraint failed: producto.codigo_producto")
                    {
                        return Err("Este codigo ya existe. Elige otro codigo por favor.".into());
                    }
                }
            }
            // cualquier otro error, lo paso tal cual
            Err(e.to_string())
        }
    }
}

/* ===== Editar básicos ===== */
#[derive(Deserialize)]
pub struct ProductoActualizarIn {
    pub id_producto: i64,
    pub codigo: Option<String>,
    pub nombre: Option<String>,
    pub activo: Option<i64>, // 1/0
}

#[tauri::command]
pub async fn producto_actualizar(state: State<'_, AppState>, input: ProductoActualizarIn)
-> Result<(), String> {
    if input.id_producto <= 0 { return Err("id_producto inválido".into()); }
    repo::producto_actualizar(
        &state.pool,
        input.id_producto,
        input.codigo.as_deref(),
        input.nombre.as_deref(),
        input.activo
    ).await.map_err(|e| e.to_string())
}

/* ===== Eliminar/Restaurar (soft delete) ===== */
#[derive(Deserialize)]
pub struct ProductoSetActivoIn { pub id_producto: i64, pub activo: bool }

#[tauri::command]
pub async fn producto_set_activo(state: State<'_, AppState>, input: ProductoSetActivoIn)
-> Result<(), String> {
    if input.id_producto <= 0 { return Err("id_producto inválido".into()); }
    repo::producto_set_activo(&state.pool, input.id_producto, input.activo)
        .await.map_err(|e| e.to_string())
}

/* ===== Ajustar stock ===== */
#[derive(Deserialize)]
pub struct StockAjusteIn { pub id_producto: i64, pub delta: i64, pub motivo: String, pub referencia: Option<String> }
#[derive(Serialize)]   pub struct StockAjusteOut { pub id_movimiento: i64, pub stock_nuevo: i64 }

#[tauri::command]
pub async fn stock_ajustar(state: State<'_, AppState>, input: StockAjusteIn)
-> Result<StockAjusteOut, String> {
    if input.id_producto <= 0 { return Err("id_producto inválido".into()); }
    if input.delta == 0 { return Err("delta no puede ser 0".into()); }
    if input.motivo.trim().is_empty() { return Err("motivo requerido".into()); }

    let id_mov = repo::stock_ajustar(
        &state.pool, input.id_producto, input.delta, &input.motivo, input.referencia.as_deref()
    ).await.map_err(|e| e.to_string())?;

    // Leer stock actual post-trigger
    let stock_nuevo: i64 = sqlx::query_scalar(
        "SELECT stock_actual FROM producto_stock WHERE id_producto=?1"
    )
    .bind(input.id_producto)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(StockAjusteOut { id_movimiento: id_mov, stock_nuevo })
}

/* ===== Actualizar precio ===== */
#[derive(Deserialize)]
pub struct PrecioActualizarIn { pub id_producto: i64, pub tipo: String, pub nuevo: i64 }

#[tauri::command]
pub async fn precio_actualizar(
    state: tauri::State<'_, crate::app_state::AppState>,
    input: PrecioActualizarIn,
) -> Result<(), String> {
    if input.id_producto <= 0 { return Err("id_producto inválido".into()); }
    if input.nuevo < 0 { return Err("precio negativo".into()); }

    let t = match input.tipo.as_str() {
        "venta" => crate::stock::repo::TipoPrecio::Venta,
        "costo" => crate::stock::repo::TipoPrecio::Costo,
        _ => return Err("tipo inválido (usa 'venta' o 'costo')".into())
    };

    // descartamos el i64
    repo::precio_actualizar(&state.pool, input.id_producto, t, input.nuevo)
        .await
        .map(|_| ())                 // <--- convierte Ok(i64) a Ok(())
        .map_err(|e| e.to_string())
}

/* ===== Historiales ===== */
#[derive(Deserialize)]
pub struct HistStockIn { pub id_producto: i64, pub limit: i64 }
#[derive(Deserialize)]
pub struct HistPrecioIn { pub id_producto: i64, pub tipo: Option<String>, pub limit: i64 }

#[derive(Serialize)]
pub struct StockMovOut { pub id_movimiento: i64, pub cantidad_delta: i64, pub motivo: String, pub referencia: Option<String>, pub fecha_hora: String }
#[derive(Serialize)]
pub struct PrecioHistOut { pub id_precio: i64, pub tipo: String, pub precio: i64, pub vigente_desde: String, pub vigente_hasta: Option<String> }

#[tauri::command]
pub async fn stock_mov_listar(state: State<'_, AppState>, input: HistStockIn)
-> Result<Vec<StockMovOut>, String> {
    let rows = repo::stock_mov_listar(&state.pool, input.id_producto, input.limit)
        .await.map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(|r| StockMovOut {
        id_movimiento: r.id_movimiento, cantidad_delta: r.cantidad_delta,
        motivo: r.motivo, referencia: r.referencia, fecha_hora: r.fecha_hora
    }).collect())
}

#[tauri::command]
pub async fn precio_hist_listar(state: State<'_, AppState>, input: HistPrecioIn)
-> Result<Vec<PrecioHistOut>, String> {
    let rows = repo::precio_hist_listar(
        &state.pool, input.id_producto, input.tipo.as_deref(), input.limit
    ).await.map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(|r| PrecioHistOut {
        id_precio: r.id_precio, tipo: r.tipo, precio: r.precio,
        vigente_desde: r.vigente_desde, vigente_hasta: r.vigente_hasta
    }).collect())
}


// repo.rs o commands.rs (según tu organización)
#[tauri::command]
pub async fn stock_fijar_absoluto(
    state: tauri::State<'_, AppState>,
    input: FixAbsInput,
) -> Result<(), String> {
    if input.nuevo < 0 {
        return Err("Stock objetivo inválido (< 0)".into());
    }

    let pool = &state.pool;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    // 1) leer actual desde producto_stock
    let actual: i64 = sqlx::query_scalar(
        "SELECT stock_actual FROM producto_stock WHERE id_producto = ?1"
    )
    .bind(input.id_producto)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // 2) fijar atómicamente en producto_stock
    let res = sqlx::query(
        "UPDATE producto_stock
         SET stock_actual = ?1, actualizado_en = CURRENT_TIMESTAMP
         WHERE id_producto = ?2 AND ?1 >= 0"
    )
    .bind(input.nuevo)
    .bind(input.id_producto)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    if res.rows_affected() != 1 {
        tx.rollback().await.ok();
        return Err("No se pudo fijar el stock (guardia de no-negatividad).".into());
    }

    // 3) registrar movimiento SOLO como historial (no debe volver a modificar producto_stock)
    let delta = input.nuevo - actual;
    if delta != 0 {
        sqlx::query(
            "INSERT INTO stock_mov (id_producto, cantidad_delta, motivo, referencia, fecha_hora)
             VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)"
        )
        .bind(input.id_producto)
        .bind(delta)
        .bind(input.motivo.unwrap_or_else(|| "ajuste_absoluto".to_string()))
        .bind(input.referencia.unwrap_or_default())
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

// tipos sugeridos
#[derive(serde::Deserialize)]
pub struct FixAbsInput {
    pub id_producto: i64,
    pub nuevo: i64,
    pub motivo: Option<String>,
    pub referencia: Option<String>,
}
