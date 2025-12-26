use serde::Serialize;
use tauri::State;

use sqlx::{FromRow, Row, SqlitePool};

use crate::AppState;


#[derive(Serialize, FromRow)]
pub struct RentabilidadProductoRow {
    pub id_producto: i64,
    pub nombre: String,
    pub cantidad_vendida: i64,
    pub ingreso_total: i64,
    pub costo_total: i64,
    pub ganancia: i64, // ganancia BRUTA (sin gastos del negocio)
}

#[derive(Serialize)]
pub struct RentabilidadReporte {
    pub fecha_desde: String,
    pub fecha_hasta: String,
    pub total_ventas: i64,
    pub total_costos: i64,
    pub ganancia_bruta: i64,
    pub margen_pct: f64,
    pub productos: Vec<RentabilidadProductoRow>,
}

fn normalizar_rango_fechas(
    fecha_desde: Option<String>,
    fecha_hasta: Option<String>,
) -> (String, String) {
    match (fecha_desde, fecha_hasta) {
        (Some(d), Some(h)) => (d, h),
        (Some(d), None) => (d.clone(), d),
        (None, Some(h)) => (h.clone(), h),
        (None, None) => {
            let hoy = chrono::Local::now().format("%Y-%m-%d").to_string();
            (hoy.clone(), hoy)
        }
    }
}

pub async fn calcular_rentabilidad(
    pool: &SqlitePool,
    fecha_desde: Option<String>,
    fecha_hasta: Option<String>,
) -> Result<RentabilidadReporte, String> {
    let (desde_str, hasta_str) = normalizar_rango_fechas(fecha_desde, fecha_hasta);

    let productos: Vec<RentabilidadProductoRow> =
        sqlx::query_as::<_, RentabilidadProductoRow>(
            r#"
            SELECT 
                vi.id_producto AS id_producto,
                p.nombre       AS nombre,
                SUM(vi.cantidad) AS cantidad_vendida,
                SUM(vi.subtotal) AS ingreso_total,
                SUM(vi.costo_unitario_en_venta * vi.cantidad) AS costo_total,
                SUM(vi.subtotal) - SUM(vi.costo_unitario_en_venta * vi.cantidad) AS ganancia
            FROM venta v
            JOIN venta_item vi ON vi.id_venta = v.id_venta
            JOIN producto p    ON p.id_producto = vi.id_producto
            WHERE 
                v.estado = 'finalizada'
                AND DATE(v.fecha_hora, 'localtime') BETWEEN DATE(?1) AND DATE(?2)
            GROUP BY vi.id_producto, p.nombre
            ORDER BY ganancia DESC
            "#
        )
        .bind(&desde_str)
        .bind(&hasta_str)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut total_ventas: i64 = 0;
    let mut total_costos: i64 = 0;

    for p in &productos {
        total_ventas += p.ingreso_total;
        total_costos += p.costo_total;
    }

    let ganancia_bruta = total_ventas - total_costos;
    let margen_pct = if total_ventas > 0 {
        (ganancia_bruta as f64) * 100.0 / (total_ventas as f64)
    } else {
        0.0
    };

    Ok(RentabilidadReporte {
        fecha_desde: desde_str,
        fecha_hasta: hasta_str,
        total_ventas,
        total_costos,
        ganancia_bruta,
        margen_pct,
        productos,
    })
}

#[tauri::command]
pub async fn reporte_rentabilidad(
    state: State<'_, AppState>,
    desde: Option<String>,
    hasta: Option<String>,
) -> Result<RentabilidadReporte, String> {
    let pool = &state.pool;
    calcular_rentabilidad(pool, desde, hasta).await
}

#[derive(Serialize, Clone)]
pub struct PeriodoMes {
    pub mes: String,         // "YYYY-MM"
    pub fecha_desde: String, // "YYYY-MM-DD"
    pub fecha_hasta: String, // "YYYY-MM-DD"
}

#[derive(Serialize, Default, Clone)]
pub struct ResumenVentasMes {
    pub total_ventas: i64,
    pub total_costos: i64,
    pub ganancia_bruta: i64,
    pub margen_bruto_pct: f64,
}

#[derive(Serialize, Clone)]
pub struct ComparacionMes {
    pub actual: ResumenVentasMes,
    pub anterior: ResumenVentasMes,

    pub delta_ventas: i64,
    pub delta_ganancia_bruta: i64,

    pub delta_ventas_pct: f64,         
    pub delta_ganancia_bruta_pct: f64, 
}

#[derive(Serialize, FromRow, Clone)]
pub struct TopProductoRow {
    pub id_producto: i64,
    pub nombre: String,
    pub cantidad_vendida: i64,
    pub ingreso_total: i64,
    pub ganancia_bruta: i64,
}

#[derive(Serialize)]
pub struct RentabilidadResumenMesReporte {
    pub periodo: PeriodoMes,
    pub periodo_anterior: PeriodoMes,

    pub resumen: ResumenVentasMes,
    pub comparacion: ComparacionMes,

    // “Highlights” simples
    pub producto_mas_vendido: Option<TopProductoRow>,  // por cantidad
    pub producto_mas_facturo: Option<TopProductoRow>,  // por ingreso_total
    pub producto_mas_ganancia: Option<TopProductoRow>, // por ganancia_bruta

    // Rankings (top N)
    pub top_por_cantidad: Vec<TopProductoRow>,
    pub top_por_ingresos: Vec<TopProductoRow>,
    pub top_por_ganancia: Vec<TopProductoRow>,
}

fn month_bounds_from_ym(ym: &str) -> Result<(String, String), String> {
    // ym: "YYYY-MM"
    let parts: Vec<&str> = ym.split('-').collect();
    if parts.len() != 2 {
        return Err("mes inválido. Formato esperado: YYYY-MM".to_string());
    }
    let year: i32 = parts[0].parse().map_err(|_| "mes inválido (año)".to_string())?;
    let month: u32 = parts[1].parse().map_err(|_| "mes inválido (mes)".to_string())?;
    if !(1..=12).contains(&month) {
        return Err("mes inválido (1..12)".to_string());
    }

    let desde = chrono::NaiveDate::from_ymd_opt(year, month, 1)
        .ok_or_else(|| "mes inválido (fecha)".to_string())?;

    // hasta = último día del mes
    let (ny, nm) = if month == 12 { (year + 1, 1) } else { (year, month + 1) };
    let next = chrono::NaiveDate::from_ymd_opt(ny, nm, 1)
        .ok_or_else(|| "mes inválido (fecha next)".to_string())?;
    let hasta = next.pred_opt().ok_or_else(|| "mes inválido (pred)".to_string())?;

    Ok((
        desde.format("%Y-%m-%d").to_string(),
        hasta.format("%Y-%m-%d").to_string(),
    ))
}

fn ym_of_local_now() -> String {
    chrono::Local::now().format("%Y-%m").to_string()
}

fn prev_ym(ym: &str) -> Result<String, String> {
    let parts: Vec<&str> = ym.split('-').collect();
    if parts.len() != 2 {
        return Err("mes inválido. Formato esperado: YYYY-MM".to_string());
    }
    let mut y: i32 = parts[0].parse().map_err(|_| "mes inválido (año)".to_string())?;
    let mut m: i32 = parts[1].parse().map_err(|_| "mes inválido (mes)".to_string())?;
    if m < 1 || m > 12 {
        return Err("mes inválido (1..12)".to_string());
    }
    m -= 1;
    if m == 0 {
        m = 12;
        y -= 1;
    }
    Ok(format!("{:04}-{:02}", y, m))
}

async fn resumen_ventas_mes(
    pool: &SqlitePool,
    desde: &str,
    hasta: &str,
) -> Result<ResumenVentasMes, String> {
    let row = sqlx::query_as::<_, (i64, i64)>(
        r#"
        SELECT
          COALESCE(SUM(vi.subtotal), 0) AS total_ventas,
          COALESCE(SUM(vi.costo_unitario_en_venta * vi.cantidad), 0) AS total_costos
        FROM venta v
        JOIN venta_item vi ON vi.id_venta = v.id_venta
        WHERE v.estado = 'finalizada'
          AND DATE(v.fecha_hora, 'localtime') BETWEEN DATE(?1) AND DATE(?2)
        "#,
    )
    .bind(desde)
    .bind(hasta)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let total_ventas = row.0;
    let total_costos = row.1;
    let ganancia_bruta = total_ventas - total_costos;
    let margen_bruto_pct = if total_ventas > 0 {
        (ganancia_bruta as f64) * 100.0 / (total_ventas as f64)
    } else {
        0.0
    };

    Ok(ResumenVentasMes {
        total_ventas,
        total_costos,
        ganancia_bruta,
        margen_bruto_pct,
    })
}

async fn top_productos(
    pool: &SqlitePool,
    desde: &str,
    hasta: &str,
    order_by: &str,
    limit: i64,
) -> Result<Vec<TopProductoRow>, String> {
    let sql = format!(
        r#"
        SELECT
          vi.id_producto AS id_producto,
          p.nombre       AS nombre,
          COALESCE(SUM(vi.cantidad), 0) AS cantidad_vendida,
          COALESCE(SUM(vi.subtotal), 0) AS ingreso_total,
          COALESCE(SUM(vi.subtotal) - SUM(vi.costo_unitario_en_venta * vi.cantidad), 0) AS ganancia_bruta
        FROM venta v
        JOIN venta_item vi ON vi.id_venta = v.id_venta
        JOIN producto p    ON p.id_producto = vi.id_producto
        WHERE v.estado = 'finalizada'
          AND DATE(v.fecha_hora, 'localtime') BETWEEN DATE(?1) AND DATE(?2)
        GROUP BY vi.id_producto, p.nombre
        ORDER BY {order_by} DESC
        LIMIT ?3
        "#
    );

    sqlx::query_as::<_, TopProductoRow>(&sql)
        .bind(desde)
        .bind(hasta)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reporte_rentabilidad_resumen_mes(
    state: State<'_, AppState>,
    mes: Option<String>, // "YYYY-MM" o None => mes actual
) -> Result<RentabilidadResumenMesReporte, String> {
    let pool = &state.pool;

    let ym = mes.unwrap_or_else(ym_of_local_now);
    let (desde, hasta) = month_bounds_from_ym(&ym)?;
    let ym_prev = prev_ym(&ym)?;
    let (desde_prev, hasta_prev) = month_bounds_from_ym(&ym_prev)?;

    let resumen = resumen_ventas_mes(pool, &desde, &hasta).await?;
    let anterior = resumen_ventas_mes(pool, &desde_prev, &hasta_prev).await?;

    let delta_ventas = resumen.total_ventas - anterior.total_ventas;
    let delta_gan = resumen.ganancia_bruta - anterior.ganancia_bruta;

    let delta_ventas_pct = if anterior.total_ventas > 0 {
        (delta_ventas as f64) * 100.0 / (anterior.total_ventas as f64)
    } else {
        0.0
    };

    let delta_ganancia_bruta_pct = if anterior.ganancia_bruta != 0 {
        (delta_gan as f64) * 100.0 / (anterior.ganancia_bruta as f64).abs()
    } else {
        0.0
    };

    let top_por_cantidad = top_productos(pool, &desde, &hasta, "cantidad_vendida", 10).await?;
    let top_por_ingresos = top_productos(pool, &desde, &hasta, "ingreso_total", 10).await?;
    let top_por_ganancia = top_productos(pool, &desde, &hasta, "ganancia_bruta", 10).await?;

    let producto_mas_vendido = top_por_cantidad.first().cloned();
    let producto_mas_facturo = top_por_ingresos.first().cloned();
    let producto_mas_ganancia = top_por_ganancia.first().cloned();

    Ok(RentabilidadResumenMesReporte {
        periodo: PeriodoMes {
            mes: ym,
            fecha_desde: desde,
            fecha_hasta: hasta,
        },
        periodo_anterior: PeriodoMes {
            mes: ym_prev,
            fecha_desde: desde_prev,
            fecha_hasta: hasta_prev,
        },
        resumen: resumen.clone(),
        comparacion: ComparacionMes {
            actual: resumen,
            anterior: anterior.clone(),
            delta_ventas,
            delta_ganancia_bruta: delta_gan,
            delta_ventas_pct,
            delta_ganancia_bruta_pct,
        },
        producto_mas_vendido,
        producto_mas_facturo,
        producto_mas_ganancia,
        top_por_cantidad,
        top_por_ingresos,
        top_por_ganancia,
    })
}



#[derive(Serialize, FromRow, Clone)]
pub struct GananciasMesRow {
    pub mes: String,        // "YYYY-MM"
    pub ventas: i64,        // suma subtotales (venta_item)
    pub cogs: i64,          // costo mercadería vendida
    pub gastos: i64,        // egresos operativos (gasto_rentabilidad)
    pub ganancia_neta: i64, // ventas - cogs - gastos
}

#[derive(Serialize)]
pub struct RentabilidadNegocioReporte {
    pub fecha_desde: String,
    pub fecha_hasta: String,

    // KPI para el período seleccionado
    pub ventas_brutas: i64,
    pub cogs: i64,
    pub gastos: i64,
    pub rentabilidad_neta: i64,
    pub margen_neto_pct: f64,

    pub rentabilidad_mes_anterior: i64,

    pub tendencia_mensual: Vec<GananciasMesRow>,
}

fn ym_from_iso_date(date_yyyy_mm_dd: &str) -> Result<String, String> {
    if date_yyyy_mm_dd.len() < 7 {
        return Err("fecha inválida. Formato esperado: YYYY-MM-DD".to_string());
    }
    Ok(date_yyyy_mm_dd[0..7].to_string())
}

fn ym_shift(ym: &str, delta_months: i32) -> Result<String, String> {
    let parts: Vec<&str> = ym.split('-').collect();
    if parts.len() != 2 {
        return Err("mes inválido. Formato esperado: YYYY-MM".to_string());
    }
    let y: i32 = parts[0].parse().map_err(|_| "mes inválido (año)".to_string())?;
    let m: i32 = parts[1].parse().map_err(|_| "mes inválido (mes)".to_string())?;
    if !(1..=12).contains(&m) {
        return Err("mes inválido (1..12)".to_string());
    }

    let abs = y * 12 + (m - 1) + delta_months;
    let ny = abs.div_euclid(12);
    let nm0 = abs.rem_euclid(12); // 0..11
    Ok(format!("{:04}-{:02}", ny, nm0 + 1))
}

fn last_n_months(end_ym: &str, n: usize) -> Result<Vec<String>, String> {
    let mut out = Vec::with_capacity(n);
    let start_offset = -(n as i32) + 1;
    for i in 0..n {
        out.push(ym_shift(end_ym, start_offset + i as i32)?);
    }
    Ok(out)
}

#[derive(Debug, Clone, Copy)]
struct TotalesPeriodo {
    ventas: i64,
    cogs: i64,
    gastos: i64,
    neto: i64,
    margen_neto_pct: f64,
}

async fn totales_periodo(pool: &SqlitePool, desde: &str, hasta: &str) -> Result<TotalesPeriodo, String> {
    // 1) Ventas + COGS (finalizadas)
    let row = sqlx::query(
        r#"
        SELECT
          COALESCE(SUM(vi.subtotal), 0) AS ventas,
          COALESCE(SUM(vi.costo_unitario_en_venta * vi.cantidad), 0) AS cogs
        FROM venta v
        JOIN venta_item vi ON vi.id_venta = v.id_venta
        WHERE v.estado = 'finalizada'
          AND DATE(v.fecha_hora, 'localtime') BETWEEN DATE(?1) AND DATE(?2)
        "#
    )
    .bind(desde)
    .bind(hasta)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("totales_periodo ventas/cogs: {e}"))?;

    let ventas: i64 = row.get("ventas");
    let cogs: i64 = row.get("cogs");

    // 2) Gastos (gasto_rentabilidad). Respetamos tu signo:
    // egreso suma, ingreso resta. Excluimos origen venta/compra como ya venías.
    let gastos: i64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(
            CASE
              WHEN tipo = 'egreso'  THEN monto
              WHEN tipo = 'ingreso' THEN -monto
              ELSE 0
            END
        ), 0)
        FROM gasto_rentabilidad
        WHERE origen NOT IN ('venta','compra')
          AND DATE(fecha, 'localtime') BETWEEN DATE(?1) AND DATE(?2)
        "#
    )
    .bind(desde)
    .bind(hasta)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("totales_periodo gastos: {e}"))?;

    let neto = ventas - cogs - gastos;

    let margen_neto_pct = if ventas > 0 {
        (neto as f64) * 100.0 / (ventas as f64)
    } else {
        0.0
    };

    Ok(TotalesPeriodo {
        ventas,
        cogs,
        gastos,
        neto,
        margen_neto_pct,
    })
}

async fn neto_periodo(pool: &SqlitePool, desde: &str, hasta: &str) -> Result<i64, String> {
    Ok(totales_periodo(pool, desde, hasta).await?.neto)
}

async fn tendencia_mensual_12m(pool: &SqlitePool, end_ym: &str) -> Result<Vec<GananciasMesRow>, String> {
    let months = last_n_months(end_ym, 12)?;
    let start_ym = months
        .first()
        .cloned()
        .ok_or("no se pudo armar rango mensual".to_string())?;

    let (desde, _) = month_bounds_from_ym(&start_ym)?;
    let (_, hasta) = month_bounds_from_ym(end_ym)?;

    let ventas_cogs = sqlx::query_as::<_, (String, i64, i64)>(
        r#"
        SELECT
          STRFTIME('%Y-%m', DATE(v.fecha_hora, 'localtime')) AS mes,
          COALESCE(SUM(vi.subtotal), 0) AS ventas,
          COALESCE(SUM(vi.costo_unitario_en_venta * vi.cantidad), 0) AS cogs
        FROM venta v
        JOIN venta_item vi ON vi.id_venta = v.id_venta
        WHERE v.estado = 'finalizada'
          AND DATE(v.fecha_hora, 'localtime') BETWEEN DATE(?1) AND DATE(?2)
        GROUP BY mes
        ORDER BY mes ASC
        "#
    )
    .bind(&desde)
    .bind(&hasta)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let gastos_rows = sqlx::query_as::<_, (String, i64)>(
        r#"
        SELECT
          STRFTIME('%Y-%m', DATE(fecha, 'localtime')) AS mes,
          COALESCE(SUM(
            CASE
              WHEN tipo = 'egreso'  THEN monto
              WHEN tipo = 'ingreso' THEN -monto
              ELSE 0
            END
          ), 0) AS gastos
        FROM gasto_rentabilidad
        WHERE origen NOT IN ('venta','compra')
          AND DATE(fecha, 'localtime') BETWEEN DATE(?1) AND DATE(?2)
        GROUP BY mes
        ORDER BY mes ASC
        "#
    )
    .bind(&desde)
    .bind(&hasta)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    use std::collections::HashMap;

    let mut map_ventas: HashMap<String, (i64, i64)> = HashMap::new();
    for (mes, v, c) in ventas_cogs {
        map_ventas.insert(mes, (v, c));
    }

    let mut map_gastos: HashMap<String, i64> = HashMap::new();
    for (mes, g) in gastos_rows {
        map_gastos.insert(mes, g);
    }

    let mut out = Vec::with_capacity(12);
    for mes in months {
        let (ventas, cogs) = map_ventas.get(&mes).copied().unwrap_or((0, 0));
        let gastos = *map_gastos.get(&mes).unwrap_or(&0);
        let ganancia_neta = ventas - cogs - gastos;

        out.push(GananciasMesRow {
            mes,
            ventas,
            cogs,
            gastos,
            ganancia_neta,
        });
    }

    Ok(out)
}

pub async fn calcular_rentabilidad_negocio(
    pool: &SqlitePool,
    fecha_desde: Option<String>,
    fecha_hasta: Option<String>,
) -> Result<RentabilidadNegocioReporte, String> {
    let (desde_str, hasta_str) = normalizar_rango_fechas(fecha_desde, fecha_hasta);

    // KPI del período (con % neto)
    let tot = totales_periodo(pool, &desde_str, &hasta_str).await?;

    // Comparativa: mes anterior al mes de 'hasta'
    let end_ym = ym_from_iso_date(&hasta_str)?;
    let prev = ym_shift(&end_ym, -1)?;
    let (desde_prev, hasta_prev) = month_bounds_from_ym(&prev)?;
    let neto_prev = neto_periodo(pool, &desde_prev, &hasta_prev).await?;

    // Tendencia 12 meses (hasta el mes de 'hasta')
    let tendencia = tendencia_mensual_12m(pool, &end_ym).await?;

    Ok(RentabilidadNegocioReporte {
        fecha_desde: desde_str,
        fecha_hasta: hasta_str,

        ventas_brutas: tot.ventas,
        cogs: tot.cogs,
        gastos: tot.gastos,
        rentabilidad_neta: tot.neto,
        margen_neto_pct: tot.margen_neto_pct,

        rentabilidad_mes_anterior: neto_prev,
        tendencia_mensual: tendencia,
    })
}

#[tauri::command]
pub async fn reporte_rentabilidad_negocio(
    state: State<'_, AppState>,
    desde: Option<String>,
    hasta: Option<String>,
) -> Result<RentabilidadNegocioReporte, String> {
    let pool = &state.pool;
    calcular_rentabilidad_negocio(pool, desde, hasta).await
}
