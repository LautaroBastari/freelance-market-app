use tauri::State;
use serde::{Serialize, Deserialize};

use crate::AppState;
use crate::stock::repo::{self, TipoPrecio};

use sqlx::Row;
use sqlx::Error as SqlxError;
use crate::stock::model::ReposicionModo;
use super::model::{StockMermaInput, CompraStockInput};
/*  Listar / Buscar  */
#[derive(Serialize)]
pub struct StockResumen {
    pub id_producto: i64,
    pub codigo: String,
    pub nombre: String,
    pub stock_actual: i64,
    pub precio_venta_actual: i64,
    pub costo_actual: i64,
    pub activo: i64,
}

#[derive(Debug, Serialize)]
pub struct StockReporteProducto {
    pub id_producto: i64,
    pub codigo_producto: String,
    pub nombre: String,
    pub stock_actual: i64,
    pub costo_unitario: i64,
    pub valor_total: i64,
    pub porcentaje_valor: f64,

    // nuevos campos para el front
    pub rotacion_dias: Option<f64>,          // cuántos días equivale el stock actual
    pub dias_stock_restante: Option<f64>,    // días estimados antes de quedarte sin stock
    pub clasificacion_abc: Option<String>,   // "A" | "B" | "C"
    pub variacion_pct: Option<f64>,          // cambio vs 30 días anteriores (%)
    pub riesgo: Option<String>,              // "alto" | "medio" | "bajo"
}

#[derive(Debug, Serialize)]
pub struct StockReporteResultado {
    pub total_inventario: i64,
    pub cantidad_productos: i64,
    pub productos: Vec<StockReporteProducto>,
}

#[derive(serde::Deserialize)]
pub struct FixAbsInput {
    pub id_producto: i64,
    pub nuevo: i64,
    pub motivo: Option<String>,
    pub referencia: Option<String>,
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
                COALESCE(ps.stock_actual, 0) AS stock_actual,
                p.precio_venta_actual,
                p.costo_actual,
                p.activo
            FROM producto p
            LEFT JOIN producto_stock ps USING(id_producto)
            WHERE (?1 = '' OR p.nombre LIKE '%'||?1||'%' OR p.codigo_producto LIKE '%'||?1||'%')
            ORDER BY p.id_producto ASC
            LIMIT ?2 OFFSET ?3
            "#
        )
        .bind(&q)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pool)
        .await
    })
    .map_err(|e| e.to_string())?;

    let out = rows
        .into_iter()
        .map(|r| crate::stock::commands::StockResumen {
            id_producto: r.get::<i64, _>(0),
            codigo: r.get::<String, _>(1),
            nombre: r.get::<String, _>(2),
            stock_actual: r.get::<i64, _>(3),
            precio_venta_actual: r.get::<i64, _>(4),
            costo_actual: r.get::<i64, _>(5),
            activo: r.get::<i64, _>(6), // <-- nuevo
        })
        .collect();

    Ok(out)
}
/* Crear producto  */
#[derive(Deserialize)]
pub struct ProductoCrearIn {
    pub codigo: String,
    pub nombre: String,
    pub precio_venta: i64,
    pub costo: i64,
    pub reposicion_modo: ReposicionModo,
    pub reposicion_factor: i64,
}

#[derive(Serialize)]
pub struct ProductoIdOut { pub id_producto: i64 }

#[tauri::command]
pub async fn producto_crear(
    state: State<'_, AppState>,
    input: ProductoCrearIn
) -> Result<ProductoIdOut, String> {
    let res = crate::stock::repo::producto_crear(
    &state.pool,
    &input.codigo,
    &input.nombre,
    input.precio_venta,
    input.costo,
    input.reposicion_modo,
    input.reposicion_factor,
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

/*  Editar básicos  */
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

/*  Eliminar/Restaurar (soft delete)  */

#[derive(Deserialize)]
pub struct ProductoSetActivoIn { pub id_producto: i64, pub activo: bool }

#[tauri::command]
pub async fn producto_set_activo(state: State<'_, AppState>, input: ProductoSetActivoIn)
-> Result<(), String> {
    if input.id_producto <= 0 { return Err("id_producto inválido".into()); }
    repo::producto_set_activo(&state.pool, input.id_producto, input.activo)
        .await.map_err(|e| e.to_string())
}

/*  Ajustar stock  */
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

/*  Actualizar precio  */
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

/*  Historiales  */
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

    //  leer actual desde producto_stock
    let actual: i64 = sqlx::query_scalar(
        "SELECT stock_actual FROM producto_stock WHERE id_producto = ?1"
    )
    .bind(input.id_producto)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    //  calcular delta que hay que aplicar
    let delta = input.nuevo - actual;

    // si no hay cambio, no hacemos nada
    if delta != 0 {
        //  obtener costo_actual del producto
        let costo_actual: i64 = sqlx::query_scalar(
            "SELECT costo_actual FROM producto WHERE id_producto = ?1"
        )
        .bind(input.id_producto)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        // Si el delta es NEGATIVO ⇒ se está sacando stock ⇒ pérdida
        // Si el delta es POSITIVO ⇒ lo tratamos como corrección sin costo económico
        let (costo_unitario_mov, total_costo_mov) = if delta < 0 {
            let unidades = -delta; // delta es negativo
            let total = unidades * costo_actual;
            (costo_actual, total)
        } else {
            (0_i64, 0_i64)
        };

        //  registrar movimiento; el TRIGGER se encarga de actualizar producto_stock
        sqlx::query(
            "INSERT INTO stock_mov (
                 id_producto,
                 cantidad_delta,
                 motivo,
                 referencia,
                 costo_unitario,
                 total_costo,
                 fecha_hora
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP)"
        )
        .bind(input.id_producto)
        .bind(delta)
        .bind(input.motivo.unwrap_or_else(|| "ajuste_absoluto_ui".to_string()))
        .bind(input.referencia.unwrap_or_default())
        .bind(costo_unitario_mov)
        .bind(total_costo_mov)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}


#[tauri::command]
pub fn reporte_stock_general(
    state: State<'_, AppState>,
    solo_activos: Option<bool>,
) -> Result<StockReporteResultado, String> {
    use std::collections::HashMap;

    let pool = &state.pool;
    // Igual que en stock_listar: si no viene nada, asumimos true
    let solo_activos = solo_activos.unwrap_or(true);

    //  Productos + stock + costo
    let filas = tauri::async_runtime::block_on(async {
        sqlx::query(
            r#"
            SELECT
                p.id_producto,
                p.codigo_producto,
                p.nombre,
                COALESCE(ps.stock_actual, 0) AS stock_actual,
                p.costo_actual               AS costo_unitario
            FROM producto p
            LEFT JOIN producto_stock ps
                ON ps.id_producto = p.id_producto
            WHERE (p.activo = 1 OR ?1 = 0)
            ORDER BY p.nombre ASC
            "#
        )
        .bind(if solo_activos { 1 } else { 0 })
        .fetch_all(pool)
        .await
    }).map_err(|e| e.to_string())?;

    //  Ventas por producto: últimos 30 días y 30 previos
    let ventas_rows = tauri::async_runtime::block_on(async {
        sqlx::query(
            r#"
            SELECT
                vi.id_producto                           AS id_producto,
                SUM(
                  CASE
                    WHEN v.fecha_hora >= DATETIME('now','localtime','-30 day')
                    THEN vi.cantidad
                    ELSE 0
                  END
                ) AS cant_30,
                SUM(
                  CASE
                    WHEN v.fecha_hora >= DATETIME('now','localtime','-60 day')
                     AND v.fecha_hora < DATETIME('now','localtime','-30 day')
                    THEN vi.cantidad
                    ELSE 0
                  END
                ) AS cant_prev_30
            FROM venta v
            JOIN venta_item vi ON vi.id_venta = v.id_venta
            WHERE v.estado = 'finalizada'
            GROUP BY vi.id_producto
            "#
        )
        .fetch_all(pool)
        .await
    }).map_err(|e| e.to_string())?;

    // mapa id_producto -> (ventas últimos 30 días, ventas 30 días previos)
    let mut ventas_map: HashMap<i64, (i64, i64)> = HashMap::new();
    for r in ventas_rows {
        let id: i64 = r.get("id_producto");
        let c30: i64 = r.get("cant_30");
        let cprev: i64 = r.get("cant_prev_30");
        ventas_map.insert(id, (c30, cprev));
    }

    let periodo_dias = 30.0_f64;

    let mut total_inventario: i64 = 0;
    let mut productos: Vec<StockReporteProducto> = Vec::new();

    // Armar productos + métricas básicas
    for r in filas {
        let id_producto: i64 = r.get("id_producto");
        let codigo_producto: String = r.get("codigo_producto");
        let nombre: String = r.get("nombre");
        let stock_actual: i64 = r.get("stock_actual");
        let costo_unitario: i64 = r.get("costo_unitario");

        let valor_total = stock_actual * costo_unitario;
        total_inventario += valor_total;

        let (ventas_30, ventas_prev_30) =
            ventas_map.get(&id_producto).cloned().unwrap_or((0, 0));

        let mut rotacion_dias: Option<f64> = None;
        let mut dias_stock_restante: Option<f64> = None;
        let variacion_pct: Option<f64>;

        if ventas_30 > 0 {
            let ventas_30_f = ventas_30 as f64;
            let stock_f = stock_actual.max(0) as f64;
            let ventas_diarias = ventas_30_f / periodo_dias;

            // cuántos días de periodo necesito para vender un stock equivalente al actual
            if stock_f > 0.0 {
                rotacion_dias = Some(periodo_dias * (stock_f / ventas_30_f));
            }

            // estimación de días de stock restante
            if ventas_diarias > 0.0 {
                dias_stock_restante = Some(stock_f / ventas_diarias);
            }
        }

        // variación % vs 30 días anteriores
        variacion_pct = if ventas_30 == 0 && ventas_prev_30 == 0 {
            None
        } else if ventas_prev_30 == 0 {
            Some(100.0)
        } else {
            Some(
                ((ventas_30 as f64 - ventas_prev_30 as f64)
                    / (ventas_prev_30 as f64))
                    * 100.0,
            )
        };

        productos.push(StockReporteProducto {
            id_producto,
            codigo_producto,
            nombre,
            stock_actual,
            costo_unitario,
            valor_total,
            porcentaje_valor: 0.0, // se completa luego
            rotacion_dias,
            dias_stock_restante,
            clasificacion_abc: None,
            variacion_pct,
            riesgo: None,
        });
    }

    // Porcentaje de cada producto sobre el valor total
    if total_inventario > 0 {
        for p in &mut productos {
            p.porcentaje_valor =
                (p.valor_total as f64) / (total_inventario as f64) * 100.0;
        }
    }

    let mut indices: Vec<usize> = (0..productos.len()).collect();
    indices.sort_by(|&i, &j| productos[j].valor_total.cmp(&productos[i].valor_total));

    let mut acumulado = 0.0_f64;

    const DIAS_RIESGO_ALTO: f64  = 7.0;
    const DIAS_RIESGO_MEDIO: f64 = 30.0;  // cambiá a 20.0 si querés

    for idx in indices {
        let p = &mut productos[idx];
        acumulado += p.porcentaje_valor;

        // ABC por valor acumulado
        let clase = if acumulado <= 80.0 {
            "A"
        } else if acumulado <= 95.0 {
            "B"
        } else {
            "C"
        };
        p.clasificacion_abc = Some(clase.to_string());

        // Datos necesarios para riesgo
        let stock: i64 = p.stock_actual;
        let dias: f64 = p.dias_stock_restante.unwrap_or(f64::INFINITY);

        // RIESGO: basado en stock + días estimados
        p.riesgo = Some(
            if stock <= 0 {
                "alto".to_string()   // sin stock = riesgo ALTO
            } else if dias <= DIAS_RIESGO_ALTO {
                "alto".to_string()
            } else if dias <= DIAS_RIESGO_MEDIO {
                "medio".to_string()
            } else {
                "bajo".to_string()
            }
        );
    }

    Ok(StockReporteResultado {
        total_inventario,
        cantidad_productos: productos.len() as i64,
        productos,
    })
}


#[tauri::command(rename = "stock_registrar_merma")]
pub async fn stock_registrar_merma(
    state: State<'_, AppState>,
    input: StockMermaInput,
) -> Result<(), String> {
    if input.cantidad <= 0 {
        return Err("La cantidad debe ser mayor a cero".to_string());
    }

    repo::registrar_merma(&state.pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command(rename = "stock_compra")]
pub async fn stock_compra(
    state: State<'_, AppState>,
    input: CompraStockInput,
) -> Result<(), String> {
    if input.cantidad <= 0 {
        return Err("Cantidad inválida".into());
    }
    if input.costo_total < 0 {
        return Err("Costo inválido".into());
    }

    let factor = repo::factor_por_unidad(input.unidad.as_str())?;
    let cantidad_maples = input.cantidad * factor;

    if cantidad_maples <= 0 {
        return Err("Cantidad resultante inválida".into());
    }

    // floor automático (entero)
    let costo_unitario = input.costo_total / cantidad_maples;

    let referencia = format!(
        "{} {} → {} maples",
        input.cantidad, input.unidad, cantidad_maples
    );

    let pool = &state.pool;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    repo::stock_compra_tx(
        &mut tx,
        input.id_producto,
        cantidad_maples,
        costo_unitario,
        input.costo_total,
        referencia,
    )
    .await?;
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}
#[derive(Debug, Deserialize)]
pub struct ReposicionRangoIn {
    pub desde: String,                 // "YYYY-MM-DD"
    pub hasta: String,                 // "YYYY-MM-DD"
    pub solo_activos: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct StockReposicionRowOut {
    pub id_producto: i64,
    pub codigo_producto: String,
    pub nombre: String,
    pub vendidos: i64,
    pub reposicion_modo: String,
    pub reposicion_factor: i64,
}

#[tauri::command(rename = "reporte_stock_reposicion")]
pub async fn reporte_stock_reposicion(
    state: State<'_, AppState>,
    input: ReposicionRangoIn,
) -> Result<Vec<StockReposicionRowOut>, String> {
    let solo_activos = input.solo_activos.unwrap_or(true);

    let rows = repo::reporte_stock_reposicion_rango(
        &state.pool,
        &input.desde,
        &input.hasta,
        solo_activos,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| StockReposicionRowOut {
            id_producto: r.id_producto,
            codigo_producto: r.codigo_producto,
            nombre: r.nombre,
            vendidos: r.vendidos,
            reposicion_modo: r.reposicion_modo,
            reposicion_factor: r.reposicion_factor,
        })
        .collect())
}

#[derive(Debug, Deserialize)]
pub struct ProductoActualizarReposicionIn {
    pub id_producto: i64,
    pub reposicion_modo: String,  // "unitario" | "cajon"
    pub reposicion_factor: i64,   // ej 12
}

#[tauri::command(rename = "producto_actualizar_reposicion")]
pub async fn producto_actualizar_reposicion(
    state: State<'_, AppState>,
    input: ProductoActualizarReposicionIn,
) -> Result<(), String> {
    repo::producto_actualizar_reposicion(
        &state.pool,
        input.id_producto,
        &input.reposicion_modo,
        input.reposicion_factor,
    )
    .await
    .map_err(|e| e.to_string())
}

