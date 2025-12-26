use std::collections::HashMap;

use tauri::State;

use crate::AppState;

use super::model::{PnlMeta, PnlPeriodo, PnlReporte, PnlReporteInput, PnlTotales};
use super::repo::{
    pnl_gastos_por_categoria, pnl_ingresos_por_medio_pago, pnl_periodos_gastos, pnl_periodos_ventas,
};

fn now_local_sql() -> &'static str {
    "DATETIME('now','localtime')"
}

fn calc_pct(num: i64, den: i64) -> Option<f64> {
    if den <= 0 {
        None
    } else {
        Some((num as f64) / (den as f64))
    }
}

fn validar_group_by(group_by: &str) -> Result<(), String> {
    match group_by {
        "dia" | "semana" | "mes" | "total" => Ok(()),
        _ => Err("group_by inválido: usar 'dia' | 'semana' | 'mes' | 'total'".to_string()),
    }
}

fn criterio_gastos_fijos(group_by: &str) -> &'static str {
    match group_by {
        "dia" | "semana" => "prorrateo_mensual_por_dia",
        "mes" | "total" => "sin_prorrateo",
        _ => "desconocido", 
    }
}

#[tauri::command]
pub async fn pnl_reporte(state: State<'_, AppState>, input: PnlReporteInput) -> Result<PnlReporte, String> {
    validar_group_by(&input.group_by)?;

    let pool = &state.pool;
    let incluir_no_finalizadas = input.incluir_no_finalizadas.unwrap_or(false);

    // 1) Ventas (ventas + COGS)
    let ventas_rows = pnl_periodos_ventas(
        pool,
        &input.desde,
        &input.hasta,
        &input.group_by,
        input.id_usuario,
        incluir_no_finalizadas,
    )
    .await?;

    // 2) Gastos/ingresos extra (con prorrateo SOLO para dia/semana, según repo.rs)
    let gastos_rows = pnl_periodos_gastos(pool, &input.desde, &input.hasta, &input.group_by).await?;

    // 3) Merge por periodo_key
    let mut map: HashMap<String, PnlPeriodo> = HashMap::new();

    for r in ventas_rows {
        let margen_bruto = r.ventas_brutas - r.costo_mercaderia_vendida;
        map.insert(
            r.periodo_key.clone(),
            PnlPeriodo {
                periodo_key: r.periodo_key,
                desde: r.desde,
                hasta: r.hasta,
                ventas_brutas: r.ventas_brutas,
                costo_mercaderia_vendida: r.costo_mercaderia_vendida,
                margen_bruto,
                ingresos_extra: 0,
                egresos_operativos: 0,
                resultado_neto: margen_bruto, // se ajusta luego
            },
        );
    }

    for g in gastos_rows {
        let entry = map.entry(g.periodo_key.clone()).or_insert(PnlPeriodo {
            periodo_key: g.periodo_key.clone(),
            // Si hay gastos pero no ventas, usamos el rango global.
            desde: input.desde.clone(),
            hasta: input.hasta.clone(),
            ventas_brutas: 0,
            costo_mercaderia_vendida: 0,
            margen_bruto: 0,
            ingresos_extra: 0,
            egresos_operativos: 0,
            resultado_neto: 0,
        });

        entry.ingresos_extra = g.ingresos_extra;
        entry.egresos_operativos = g.egresos_operativos;
        entry.resultado_neto = (entry.margen_bruto + entry.ingresos_extra) - entry.egresos_operativos;
    }

    // 4) Orden
    let mut periodos: Vec<PnlPeriodo> = map.into_values().collect();
    periodos.sort_by(|a, b| a.periodo_key.cmp(&b.periodo_key));

    // 5) Totales
    let mut tot = PnlTotales::default();
    for p in &periodos {
        tot.ventas_brutas += p.ventas_brutas;
        tot.costo_mercaderia_vendida += p.costo_mercaderia_vendida;
        tot.ingresos_extra += p.ingresos_extra;
        tot.egresos_operativos += p.egresos_operativos;
    }
    tot.margen_bruto = tot.ventas_brutas - tot.costo_mercaderia_vendida;
    tot.resultado_neto = (tot.margen_bruto + tot.ingresos_extra) - tot.egresos_operativos;

    tot.margen_bruto_pct = calc_pct(tot.margen_bruto, tot.ventas_brutas);
    tot.resultado_neto_pct = calc_pct(tot.resultado_neto, tot.ventas_brutas);

    // 6) Desglose por categoría (global del rango)
    let gastos_por_categoria = pnl_gastos_por_categoria(pool, &input.desde, &input.hasta).await?;

    // 7) Ingresos por medio de pago
    let ingresos_por_medio_pago = Some(
        pnl_ingresos_por_medio_pago(
            pool,
            &input.desde,
            &input.hasta,
            input.id_usuario,
            incluir_no_finalizadas,
        )
        .await?,
    );

    // 8) Meta (timestamp consistente)
    let generado_en: String = sqlx::query_scalar(&format!("SELECT {}", now_local_sql()))
        .fetch_one(pool)
        .await
        .map_err(|e| format!("pnl_reporte generado_en: {e}"))?;

    Ok(PnlReporte {
        meta: PnlMeta {
            desde: input.desde,
            hasta: input.hasta,
            group_by: input.group_by.clone(),
            moneda: "ARS".to_string(),
            generado_en,
            criterio_costos: "snapshot_en_venta".to_string(),
            criterio_gastos_fijos: criterio_gastos_fijos(&input.group_by).to_string(),
        },
        totales: tot,
        periodos,
        gastos_por_categoria,
        ingresos_por_medio_pago,
    })
}
