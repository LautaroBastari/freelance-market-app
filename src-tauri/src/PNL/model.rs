use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/* INPUT*/

#[derive(Debug, Deserialize)]
pub struct PnlReporteInput {
    /// "YYYY-MM-DD"
    pub desde: String,
    /// "YYYY-MM-DD"
    pub hasta: String,
    /// "dia" | "semana" | "mes" | "total"
    pub group_by: String,

    /// filtrar ventas por usuario (operador)
    pub id_usuario: Option<i64>,

    /// si true, NO filtra por estado finalizada
    pub incluir_no_finalizadas: Option<bool>,
}

/*  OUTPUT */

#[derive(Debug, Serialize)]
pub struct PnlReporte {
    pub meta: PnlMeta,
    pub totales: PnlTotales,
    pub periodos: Vec<PnlPeriodo>,
    pub gastos_por_categoria: Vec<PnlGastoCategoria>,
    pub ingresos_por_medio_pago: Option<Vec<PnlMedioPago>>,
}

#[derive(Debug, Serialize)]
pub struct PnlMeta {
    pub desde: String,
    pub hasta: String,
    pub group_by: String,
    pub moneda: String,
    pub generado_en: String,
    pub criterio_costos: String,
    pub criterio_gastos_fijos: String,
}

#[derive(Debug, Serialize, Default, Clone)]
pub struct PnlTotales {
    pub ventas_brutas: i64,
    pub costo_mercaderia_vendida: i64,
    pub margen_bruto: i64,
    pub margen_bruto_pct: Option<f64>,
    pub ingresos_extra: i64,
    pub egresos_operativos: i64,
    pub resultado_neto: i64,
    pub resultado_neto_pct: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct PnlPeriodo {
    pub periodo_key: String,
    pub desde: String,
    pub hasta: String,

    pub ventas_brutas: i64,
    pub costo_mercaderia_vendida: i64,
    pub margen_bruto: i64,

    pub ingresos_extra: i64,
    pub egresos_operativos: i64,
    pub resultado_neto: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct PnlPeriodoVentasRow {
    pub periodo_key: String,
    pub desde: String,
    pub hasta: String,
    pub ventas_brutas: i64,
    pub costo_mercaderia_vendida: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct PnlPeriodoGastosRow {
    pub periodo_key: String,
    pub ingresos_extra: i64,
    pub egresos_operativos: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct PnlGastoCategoria {
    pub categoria: String,
    pub ingresos: i64,
    pub egresos: i64,
    pub neto: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct PnlMedioPago {
    pub medio: String,
    pub monto: i64,
}
