use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tauri::State;

use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct VentasAdminListarInput {
    pub desde: String,                 // "YYYY-MM-DD"
    pub hasta: String,                 // "YYYY-MM-DD"
    pub id_usuario: Option<i64>,        // null = todos
    pub estado: Option<String>,         // null = todos (ej: "finalizada")
    pub medio: Option<String>,          // null = todos (ej: "efectivo")
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct UsuarioOperadorRow {
    pub id_usuario: i64,
    pub nombre: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct VentaAdminResumenRow {
    pub id_venta: i64,
    pub fecha_hora: String,        // "YYYY-MM-DD HH:MM:SS"
    pub id_usuario: i64,
    pub usuario: String,
    pub id_caja: i64,
    pub total: i64,
    pub estado: String,

    pub cant_items: i64,
    pub unidades: i64,
    pub costo_total: i64,

    pub ganancia_bruta: i64,       // total - costo_total
    pub margen_pct: f64,           // 0..100

    pub pagos_resumen: Option<String>, // "efectivo: $1000 | debito: $2000"
}


#[derive(Debug, Serialize, FromRow)]
pub struct VentaAdminItemRow {
    pub id_item: i64,
    pub id_producto: i64,
    pub codigo: String,
    pub producto: String,
    pub cantidad: i64,
    pub precio_unitario: i64,
    pub costo_unitario_en_venta: i64,
    pub subtotal: i64,
    pub fuente_precio: String,

    pub costo_linea: i64,          // cantidad * costo_unitario_en_venta
    pub ganancia_linea: i64,       // subtotal - costo_linea
}

#[derive(Debug, Serialize, FromRow)]
pub struct VentaAdminPagoRow {
    pub medio: String,
    pub monto: i64,
    pub referencia: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct VentaAdminDetalle {
    pub resumen: VentaAdminResumenRow,
    pub items: Vec<VentaAdminItemRow>,
    pub pagos: Vec<VentaAdminPagoRow>,
}

#[derive(Debug, Serialize)]
pub struct Paginado<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

#[tauri::command]
pub async fn ventas_admin_listar(
    state: State<'_, AppState>,
    input: VentasAdminListarInput,
) -> Result<Paginado<VentaAdminResumenRow>, String> {
    let pool = &state.pool;

    let limit = input.limit.unwrap_or(100).clamp(1, 500);
    let offset = input.offset.unwrap_or(0).max(0);

    // ITEMS
    let items = sqlx::query_as::<_, VentaAdminResumenRow>(
        r#"
        WITH
        ventas_filtradas AS (
            SELECT v.id_venta, v.fecha_hora, v.id_usuario, u.nombre AS usuario, v.id_caja, v.total, v.estado
            FROM venta v
            JOIN usuario u ON u.id_usuario = v.id_usuario
            WHERE date(v.fecha_hora) BETWEEN date(?) AND date(?)
            AND (? IS NULL OR v.id_usuario = ?)
            AND (? IS NULL OR v.estado = ?)
            AND (
                ? IS NULL
                OR EXISTS (
                    SELECT 1 FROM venta_pago vp
                    WHERE vp.id_venta = v.id_venta AND vp.medio = ?
                )
            )
        ),
        items_aggr AS (
            SELECT
                vi.id_venta,
                COUNT(*) AS cant_items,
                COALESCE(SUM(vi.cantidad), 0) AS unidades,
                COALESCE(SUM(vi.cantidad * vi.costo_unitario_en_venta), 0) AS costo_total
            FROM venta_item vi
            GROUP BY vi.id_venta
        ),
        pagos_aggr AS (
            SELECT
                vp.id_venta,
                GROUP_CONCAT(vp.medio || ': $' || vp.monto, ' | ') AS pagos_resumen
            FROM venta_pago vp
            GROUP BY vp.id_venta
        )
        SELECT
            vf.id_venta,
            vf.fecha_hora,
            vf.id_usuario,
            vf.usuario,
            vf.id_caja,
            vf.total,
            vf.estado,

            COALESCE(ia.cant_items, 0) AS cant_items,
            COALESCE(ia.unidades, 0) AS unidades,
            COALESCE(ia.costo_total, 0) AS costo_total,

            (vf.total - COALESCE(ia.costo_total, 0)) AS ganancia_bruta,

            CASE
            WHEN vf.total <= 0 THEN 0.0
            ELSE ROUND( ( (vf.total - COALESCE(ia.costo_total, 0)) * 100.0 ) / vf.total, 2)
            END AS margen_pct,

            pa.pagos_resumen
        FROM ventas_filtradas vf
        LEFT JOIN items_aggr ia ON ia.id_venta = vf.id_venta
        LEFT JOIN pagos_aggr pa ON pa.id_venta = vf.id_venta
        ORDER BY vf.fecha_hora DESC
        LIMIT ? OFFSET ?;
                "#
            )
            .bind(&input.desde)
            .bind(&input.hasta)
            .bind(input.id_usuario)
            .bind(input.id_usuario)
            .bind(input.estado.as_deref())
            .bind(input.estado.as_deref())
            .bind(input.medio.as_deref())
            .bind(input.medio.as_deref())
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("ventas_admin_listar(items): {}", e))?;

            // TOTAL (COUNT)
            let total: i64 = sqlx::query_scalar(
                r#"
        SELECT COUNT(*)
        FROM venta v
        WHERE date(v.fecha_hora) BETWEEN date(?) AND date(?)
        AND (? IS NULL OR v.id_usuario = ?)
        AND (? IS NULL OR v.estado = ?)
        AND (
            ? IS NULL
            OR EXISTS (
                SELECT 1 FROM venta_pago vp
                WHERE vp.id_venta = v.id_venta AND vp.medio = ?
            )
        );
        "#
    )
    .bind(&input.desde)
    .bind(&input.hasta)
    .bind(input.id_usuario)
    .bind(input.id_usuario)
    .bind(input.estado.as_deref())
    .bind(input.estado.as_deref())
    .bind(input.medio.as_deref())
    .bind(input.medio.as_deref())
    .fetch_one(pool)
    .await
    .map_err(|e| format!("ventas_admin_listar(total): {}", e))?;

    Ok(Paginado { items, total, limit, offset })
}


#[tauri::command]
pub async fn venta_admin_detalle(
    state: State<'_, AppState>,
    id_venta: i64,
) -> Result<VentaAdminDetalle, String> {
    let pool = &state.pool;

    // Resumen (misma lógica de arriba, pero para una venta)
    let resumen = sqlx::query_as::<_, VentaAdminResumenRow>(
        r#"
            WITH
            vbase AS (
                SELECT v.id_venta, v.fecha_hora, v.id_usuario, u.nombre AS usuario, v.id_caja, v.total, v.estado
                FROM venta v
                JOIN usuario u ON u.id_usuario = v.id_usuario
                WHERE v.id_venta = ?
            ),
            items_aggr AS (
                SELECT
                    vi.id_venta,
                    COUNT(*) AS cant_items,
                    COALESCE(SUM(vi.cantidad), 0) AS unidades,
                    COALESCE(SUM(vi.cantidad * vi.costo_unitario_en_venta), 0) AS costo_total
                FROM venta_item vi
                WHERE vi.id_venta = ?
                GROUP BY vi.id_venta
            ),
            pagos_aggr AS (
                SELECT
                    vp.id_venta,
                    GROUP_CONCAT(vp.medio || ': $' || vp.monto, ' | ') AS pagos_resumen
                FROM venta_pago vp
                WHERE vp.id_venta = ?
                GROUP BY vp.id_venta
            )
            SELECT
                vb.id_venta,
                vb.fecha_hora,
                vb.id_usuario,
                vb.usuario,
                vb.id_caja,
                vb.total,
                vb.estado,

                COALESCE(ia.cant_items, 0) AS cant_items,
                COALESCE(ia.unidades, 0) AS unidades,
                COALESCE(ia.costo_total, 0) AS costo_total,

                (vb.total - COALESCE(ia.costo_total, 0)) AS ganancia_bruta,

                CASE
                WHEN vb.total <= 0 THEN 0.0
                ELSE ROUND( ( (vb.total - COALESCE(ia.costo_total, 0)) * 100.0 ) / vb.total, 2)
                END AS margen_pct,

                pa.pagos_resumen
            FROM vbase vb
            LEFT JOIN items_aggr ia ON ia.id_venta = vb.id_venta
            LEFT JOIN pagos_aggr pa ON pa.id_venta = vb.id_venta;
        "#
    )
    .bind(id_venta)
    .bind(id_venta)
    .bind(id_venta)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("venta_admin_detalle(resumen): {}", e))?;

    //  Items
    let items = sqlx::query_as::<_, VentaAdminItemRow>(
    r#"
    SELECT
        vi.id_item,
        vi.id_producto,
        p.codigo_producto AS codigo,
        p.nombre AS producto,
        vi.cantidad,
        vi.precio_unitario,
        vi.costo_unitario_en_venta,
        vi.subtotal,
        vi.fuente_precio,

        (vi.cantidad * vi.costo_unitario_en_venta) AS costo_linea,
        (vi.subtotal - (vi.cantidad * vi.costo_unitario_en_venta)) AS ganancia_linea
    FROM venta_item vi
    JOIN producto p ON p.id_producto = vi.id_producto
    WHERE vi.id_venta = ?
    ORDER BY vi.id_item ASC;
        "#
    )
    .bind(id_venta)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("venta_admin_detalle(items): {}", e))?;


    //  Pagos
    let pagos = sqlx::query_as::<_, VentaAdminPagoRow>(
        r#"
        SELECT medio, monto, referencia
        FROM venta_pago
        WHERE id_venta = ?
        ORDER BY medio ASC;
        "#
    )
    .bind(id_venta)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("venta_admin_detalle(pagos): {}", e))?;

    Ok(VentaAdminDetalle { resumen, items, pagos })
}


#[tauri::command]
pub async fn usuarios_listar_operadores(
    state: State<'_, AppState>,
) -> Result<Vec<UsuarioOperadorRow>, String> {
    let pool = &state.pool;
    let rows = sqlx::query_as::<_, UsuarioOperadorRow>(
        r#"
        SELECT u.id_usuario, u.nombre
        FROM usuario u
        WHERE lower(u.rol_tipo) = 'operador'
        ORDER BY u.nombre ASC;
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("usuarios_listar_operadores: {}", e))?;

    Ok(rows)
}