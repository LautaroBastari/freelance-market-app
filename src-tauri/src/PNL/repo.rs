use sqlx::SqlitePool;

use super::model::{
    PnlGastoCategoria, PnlMedioPago, PnlPeriodoGastosRow, PnlPeriodoVentasRow,
};

fn key_expr_ventas(group_by: &str) -> Result<String, String> {
    let expr = match group_by {
        "dia" => "DATE(v.fecha_hora, 'localtime')".to_string(),
        "semana" => "STRFTIME('%Y-W%W', v.fecha_hora, 'localtime')".to_string(),
        "mes" => "STRFTIME('%Y-%m', v.fecha_hora, 'localtime')".to_string(),
        "total" => "'TOTAL'".to_string(),
        _ => return Err("group_by inválido: usar 'dia' | 'semana' | 'mes' | 'total'".to_string()),
    };
    Ok(expr)
}

fn key_expr_gastos(group_by: &str) -> Result<String, String> {
    let expr = match group_by {
        "dia" => "g.fecha".to_string(),
        "semana" => "STRFTIME('%Y-W%W', g.fecha)".to_string(),
        "mes" => "STRFTIME('%Y-%m', g.fecha)".to_string(),
        "total" => "'TOTAL'".to_string(),
        _ => return Err("group_by inválido: usar 'dia' | 'semana' | 'mes' | 'total'".to_string()),
    };
    Ok(expr)
}


fn key_expr_gastos_prorrateo(group_by: &str) -> Result<String, String> {
    let expr = match group_by {
        "dia" => "dia".to_string(),
        "semana" => "STRFTIME('%Y-W%W', dia)".to_string(),
        // No se usa en prorrateo (por diseño)
        _ => return Err("prorrateo solo aplica a 'dia' o 'semana'".to_string()),
    };
    Ok(expr)
}

fn estado_filter_sql(incluir_no_finalizadas: bool) -> Option<&'static str> {
    if incluir_no_finalizadas {
        None
    } else {
        Some("v.estado = 'finalizada'")
    }
}
pub async fn pnl_periodos_ventas(
    pool: &SqlitePool,
    desde: &str,
    hasta: &str,
    group_by: &str,
    id_usuario: Option<i64>,
    incluir_no_finalizadas: bool,
) -> Result<Vec<PnlPeriodoVentasRow>, String> {
    let key = key_expr_ventas(group_by)?;

    // Ventas desde "venta" (SIN join) + COGS desde "venta_item" (join solo para filtrar)
    let mut sql = format!(
        r#"
        WITH ventas AS (
          SELECT
            {key} AS periodo_key,
            MIN(DATE(v.fecha_hora,'localtime')) AS desde,
            MAX(DATE(v.fecha_hora,'localtime')) AS hasta,
            COALESCE(SUM(v.total), 0) AS ventas_brutas
          FROM venta v
          WHERE DATE(v.fecha_hora,'localtime') BETWEEN ? AND ?
        "#,
    );

    // filtros ventas
    if let Some(f) = estado_filter_sql(incluir_no_finalizadas) {
        sql.push_str(" AND ");
        sql.push_str(f);
    }
    if id_usuario.is_some() {
        sql.push_str(" AND v.id_usuario = ? ");
    }

    sql.push_str(&format!(
        r#"
          GROUP BY {key}
        ),
        cogs AS (
          SELECT
            {key} AS periodo_key,
            COALESCE(SUM(vi.costo_unitario_en_venta * vi.cantidad), 0) AS costo_mercaderia_vendida
          FROM venta v
          LEFT JOIN venta_item vi ON vi.id_venta = v.id_venta
          WHERE DATE(v.fecha_hora,'localtime') BETWEEN ? AND ?
        "#
    ));

    // filtros cogs (mismos que ventas)
    if let Some(f) = estado_filter_sql(incluir_no_finalizadas) {
        sql.push_str(" AND ");
        sql.push_str(f);
    }
    if id_usuario.is_some() {
        sql.push_str(" AND v.id_usuario = ? ");
    }

    sql.push_str(
        r#"
          GROUP BY periodo_key
        )
        SELECT
          v.periodo_key,
          v.desde,
          v.hasta,
          v.ventas_brutas,
          COALESCE(c.costo_mercaderia_vendida, 0) AS costo_mercaderia_vendida
        FROM ventas v
        LEFT JOIN cogs c ON c.periodo_key = v.periodo_key
        ORDER BY v.periodo_key ASC
        "#,
    );

    let mut q = sqlx::query_as::<_, PnlPeriodoVentasRow>(&sql)
        .bind(desde)
        .bind(hasta);

    if let Some(u) = id_usuario {
        q = q.bind(u);
    }

    q = q.bind(desde).bind(hasta);

    if let Some(u) = id_usuario {
        q = q.bind(u);
    }

    q.fetch_all(pool)
        .await
        .map_err(|e| format!("pnl_periodos_ventas: {e}"))
}


pub async fn pnl_periodos_gastos(
    pool: &SqlitePool,
    desde: &str,
    hasta: &str,
    group_by: &str,
) -> Result<Vec<PnlPeriodoGastosRow>, String> {
    match group_by {
        "mes" | "total" => {
            let key = key_expr_gastos(group_by)?;

            let sql = format!(
                r#"
                SELECT
                  {key} AS periodo_key,
                  COALESCE(SUM(CASE WHEN g.tipo='ingreso' THEN g.monto ELSE 0 END), 0) AS ingresos_extra,
                  COALESCE(SUM(CASE WHEN g.tipo='egreso'  THEN g.monto ELSE 0 END), 0) AS egresos_operativos
                FROM gasto_rentabilidad g
                WHERE g.fecha BETWEEN ? AND ?
                GROUP BY {key}
                ORDER BY {key} ASC
                "#
            );

            sqlx::query_as::<_, PnlPeriodoGastosRow>(&sql)
                .bind(desde)
                .bind(hasta)
                .fetch_all(pool)
                .await
                .map_err(|e| format!("pnl_periodos_gastos(mes/total): {e}"))
        }

        "dia" | "semana" => {
            let key = key_expr_gastos_prorrateo(group_by)?;

            let sql = format!(
                r#"
                WITH RECURSIVE days(dia) AS (
                  SELECT DATE(?1)
                  UNION ALL
                  SELECT DATE(dia, '+1 day')
                  FROM days
                  WHERE dia < DATE(?2)
                ),
                mensual AS (
                  SELECT
                    STRFTIME('%Y-%m', g.fecha) AS ym,
                    COALESCE(SUM(CASE WHEN g.tipo='ingreso' THEN g.monto ELSE 0 END), 0) AS ingresos,
                    COALESCE(SUM(CASE WHEN g.tipo='egreso'  THEN g.monto ELSE 0 END), 0) AS egresos
                  FROM gasto_rentabilidad g
                  WHERE g.fecha BETWEEN ?1 AND ?2
                  GROUP BY ym
                ),
                calendario AS (
                  SELECT
                    dia,
                    STRFTIME('%Y-%m', dia) AS ym,
                    CAST(STRFTIME('%d', DATE(dia, 'start of month', '+1 month', '-1 day')) AS INTEGER) AS dias_en_mes
                  FROM days
                ),
                diario AS (
                  SELECT
                    c.dia AS dia,
                    (COALESCE(m.ingresos, 0) * 1.0) / c.dias_en_mes AS ingreso_diario,
                    (COALESCE(m.egresos,  0) * 1.0) / c.dias_en_mes AS egreso_diario
                  FROM calendario c
                  LEFT JOIN mensual m ON m.ym = c.ym
                )
                SELECT
                  {key} AS periodo_key,
                  COALESCE(CAST(SUM(ROUND(ingreso_diario)) AS INTEGER), 0) AS ingresos_extra,
                  COALESCE(CAST(SUM(ROUND(egreso_diario))  AS INTEGER), 0) AS egresos_operativos
                FROM diario
                GROUP BY periodo_key
                ORDER BY periodo_key ASC
                "#
            );

            sqlx::query_as::<_, PnlPeriodoGastosRow>(&sql)
                .bind(desde)
                .bind(hasta)
                .fetch_all(pool)
                .await
                .map_err(|e| format!("pnl_periodos_gastos(prorrateo dia/semana): {e}"))
        }

        _ => Err("group_by inválido: usar 'dia' | 'semana' | 'mes' | 'total'".to_string()),
    }
}


pub async fn pnl_gastos_por_categoria(
    pool: &SqlitePool,
    desde: &str,
    hasta: &str,
) -> Result<Vec<PnlGastoCategoria>, String> {
    let sql = r#"
      SELECT
        g.categoria AS categoria,
        COALESCE(SUM(CASE WHEN g.tipo='ingreso' THEN g.monto ELSE 0 END), 0) AS ingresos,
        COALESCE(SUM(CASE WHEN g.tipo='egreso'  THEN g.monto ELSE 0 END), 0) AS egresos,
        COALESCE(SUM(CASE WHEN g.tipo='ingreso' THEN g.monto ELSE -g.monto END), 0) AS neto
      FROM gasto_rentabilidad g
      WHERE g.fecha BETWEEN ? AND ?
      GROUP BY g.categoria
      ORDER BY g.categoria ASC
    "#;

    sqlx::query_as::<_, PnlGastoCategoria>(sql)
        .bind(desde)
        .bind(hasta)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("pnl_gastos_por_categoria: {e}"))
}

pub async fn pnl_ingresos_por_medio_pago(
    pool: &SqlitePool,
    desde: &str,
    hasta: &str,
    id_usuario: Option<i64>,
    incluir_no_finalizadas: bool,
) -> Result<Vec<PnlMedioPago>, String> {
    let mut sql = r#"
      SELECT
        vp.medio AS medio,
        COALESCE(SUM(vp.monto), 0) AS monto
      FROM venta_pago vp
      INNER JOIN venta v ON v.id_venta = vp.id_venta
      WHERE DATE(v.fecha_hora,'localtime') BETWEEN ? AND ?
    "#
    .to_string();

    if let Some(f) = estado_filter_sql(incluir_no_finalizadas) {
        sql.push_str(" AND ");
        sql.push_str(f);
    }
    if id_usuario.is_some() {
        sql.push_str(" AND v.id_usuario = ? ");
    }

    sql.push_str(" GROUP BY vp.medio ORDER BY vp.medio ASC ");

    let mut q = sqlx::query_as::<_, PnlMedioPago>(&sql)
        .bind(desde)
        .bind(hasta);

    if let Some(u) = id_usuario {
        q = q.bind(u);
    }

    q.fetch_all(pool)
        .await
        .map_err(|e| format!("pnl_ingresos_por_medio_pago: {e}"))
}
