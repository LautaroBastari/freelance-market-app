use sqlx::{Row, SqlitePool};

use super::model::{AdminHomeAlerta, AdminHomeResumen, AdminHomeTopProductoHoy};

fn venta_estado_final_sql() -> &'static str {
    "(v.estado = 'finalizada' OR v.estado = 'cerrada' OR v.estado = 'pagada')"
}

pub async fn admin_home_resumen(pool: &SqlitePool) -> Result<AdminHomeResumen, sqlx::Error> {
    // Ventas HOY (total + cant)
    let ventas_hoy_row = sqlx::query(&format!(
        r#"
        SELECT
          COALESCE(SUM(v.total), 0) AS ventas_total,
          COALESCE(COUNT(*), 0)     AS ventas_cant
        FROM venta v
        WHERE DATE(v.fecha_hora) = DATE('now','localtime')
          AND {}
        "#,
        venta_estado_final_sql()
    ))
    .fetch_one(pool)
    .await?;

    let ventas_hoy_total: i64 = ventas_hoy_row.get("ventas_total");
    let ventas_hoy_cant: i64 = ventas_hoy_row.get("ventas_cant");

    // COGS HOY
    let cogs_hoy_row = sqlx::query(&format!(
        r#"
        SELECT
          COALESCE(SUM(vi.cantidad * vi.costo_unitario_en_venta), 0) AS cogs_total
        FROM venta_item vi
        JOIN venta v ON v.id_venta = vi.id_venta
        WHERE DATE(v.fecha_hora) = DATE('now','localtime')
          AND {}
        "#,
        venta_estado_final_sql()
    ))
    .fetch_one(pool)
    .await?;

    let cogs_hoy_total: i64 = cogs_hoy_row.get("cogs_total");

    // Gastos HOY
    let gastos_hoy_row = sqlx::query(
        r#"
        SELECT COALESCE(SUM(g.monto), 0) AS gastos_total
        FROM gasto_rentabilidad g
        WHERE DATE(g.fecha) = DATE('now','localtime')
        "#,
    )
    .fetch_one(pool)
    .await?;

    let gastos_hoy_total: i64 = gastos_hoy_row.get("gastos_total");

    // Resultado HOY
    let resultado_hoy_neto: i64 = ventas_hoy_total - cogs_hoy_total - gastos_hoy_total;

    // Mes actual: ventas / cogs / gastos
    let ventas_mes_row = sqlx::query(&format!(
        r#"
        SELECT COALESCE(SUM(v.total), 0) AS ventas_total
        FROM venta v
        WHERE strftime('%Y-%m', v.fecha_hora) = strftime('%Y-%m','now','localtime')
          AND {}
        "#,
        venta_estado_final_sql()
    ))
    .fetch_one(pool)
    .await?;

    let ventas_mes_total: i64 = ventas_mes_row.get("ventas_total");

    let cogs_mes_row = sqlx::query(&format!(
        r#"
        SELECT COALESCE(SUM(vi.cantidad * vi.costo_unitario_en_venta), 0) AS cogs_total
        FROM venta_item vi
        JOIN venta v ON v.id_venta = vi.id_venta
        WHERE strftime('%Y-%m', v.fecha_hora) = strftime('%Y-%m','now','localtime')
          AND {}
        "#,
        venta_estado_final_sql()
    ))
    .fetch_one(pool)
    .await?;

    let cogs_mes_total: i64 = cogs_mes_row.get("cogs_total");

    let gastos_mes_row = sqlx::query(
        r#"
        SELECT COALESCE(SUM(g.monto), 0) AS gastos_total
        FROM gasto_rentabilidad g
        WHERE strftime('%Y-%m', g.fecha) = strftime('%Y-%m','now','localtime')
        "#,
    )
    .fetch_one(pool)
    .await?;

    let gastos_mes_total: i64 = gastos_mes_row.get("gastos_total");

    let resultado_mes_neto: i64 = ventas_mes_total - cogs_mes_total - gastos_mes_total;


    // Stock crítico
    // Definición "crítico": stock_actual <= 0 (cero o negativo), es permitido ya que no se confia en la gestión de stock perfecta del usuario
    let stock_critico_row = sqlx::query(
        r#"
        SELECT COALESCE(COUNT(*),0) AS n
        FROM producto p
        JOIN producto_stock s ON s.id_producto = p.id_producto
        WHERE COALESCE(p.activo, 1) = 1
          AND COALESCE(s.stock_actual, 0) <= 0
        "#,
    )
    .fetch_one(pool)
    .await?;

    let stock_critico_cant: i64 = stock_critico_row.get("n");

    // Alertas
    let mut alertas: Vec<AdminHomeAlerta> = Vec::new();

    if stock_critico_cant > 0 {
        alertas.push(AdminHomeAlerta {
            nivel: "warn".to_string(),
            texto: format!("Hay {stock_critico_cant} productos con stock crítico (≤ 0)."),
        });
    }

    // Ventas no finalizadas HOY
    let ventas_pend_row = sqlx::query(&format!(
        r#"
        SELECT COALESCE(COUNT(*),0) AS n
        FROM venta v
        WHERE DATE(v.fecha_hora) = DATE('now','localtime')
          AND NOT {}
        "#,
        venta_estado_final_sql()
    ))
    .fetch_one(pool)
    .await?;

    let ventas_pend: i64 = ventas_pend_row.get("n");
    if ventas_pend > 0 {
        alertas.push(AdminHomeAlerta {
            nivel: "warn".to_string(),
            texto: format!("Hay {ventas_pend} ventas de hoy que no están finalizadas."),
        });
    }

    let sin_costo_row = sqlx::query(
        r#"
        SELECT COALESCE(COUNT(*),0) AS n
        FROM producto p
        WHERE COALESCE(p.costo_actual, 0) <= 0
          AND COALESCE(p.activo, 1) = 1
        "#,
    )
    .fetch_one(pool)
    .await?;

    let sin_costo: i64 = sin_costo_row.get("n");
    if sin_costo > 0 {
        alertas.push(AdminHomeAlerta {
            nivel: "info".to_string(),
            texto: format!("Hay {sin_costo} productos activos sin costo cargado."),
        });
    }
    // Top producto HOY 
    let top_prod_row = sqlx::query(&format!(
        r#"
        SELECT
        p.id_producto                         AS id_producto,
        p.nombre                              AS nombre,
        COALESCE(SUM(vi.cantidad), 0)         AS cantidad,
        COALESCE(SUM(vi.subtotal), 0)         AS recaudado
        FROM venta_item vi
        JOIN venta v     ON v.id_venta = vi.id_venta
        JOIN producto p  ON p.id_producto = vi.id_producto
        WHERE DATE(v.fecha_hora) = DATE('now','localtime')
        AND {}
        GROUP BY p.id_producto, p.nombre
        ORDER BY cantidad DESC, recaudado DESC
        LIMIT 1
        "#,
        venta_estado_final_sql()
    ))
    .fetch_optional(pool)
    .await?;

    let top_producto_hoy: Option<AdminHomeTopProductoHoy> = top_prod_row.map(|r| AdminHomeTopProductoHoy {
        id_producto: r.get("id_producto"),
        nombre: r.get("nombre"),
        cantidad: r.get("cantidad"),
        recaudado: r.get("recaudado"),
    });
    Ok(AdminHomeResumen {
    ventas_hoy_total,
    ventas_hoy_cant,
    resultado_mes_neto,
    stock_critico_cant,
    top_producto_hoy,
    alertas,
    })
}
