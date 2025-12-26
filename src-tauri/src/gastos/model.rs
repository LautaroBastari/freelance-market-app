use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// INPUTS

#[derive(Debug, Deserialize)]
pub struct SueldoRegistrarInput {
    pub descripcion: String,
    pub monto: i64,
    pub id_usuario_destino: Option<i64>,
    pub fecha_hora: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GastoRegistrarInput {
    pub categoria: String,
    pub descripcion: Option<String>,
    pub monto: i64,
    pub fecha_hora: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PeriodoInput {
    pub fecha_desde: String, // "YYYY-MM-DD"
    pub fecha_hasta: String, // "YYYY-MM-DD"
}

#[derive(Debug, Deserialize)]
pub struct GastoListarPeriodoInput {
    pub fecha_desde: String, // "YYYY-MM-DD"
    pub fecha_hasta: String, // "YYYY-MM-DD"
    pub categoria: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SueldoListarPeriodoInput {
    pub fecha_desde: String, // "YYYY-MM-DD"
    pub fecha_hasta: String, // "YYYY-MM-DD"
    pub id_usuario_destino: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct TotalesPeriodoInput {
    pub fecha_desde: String,            // "YYYY-MM-DD"
    pub fecha_hasta: String,            // "YYYY-MM-DD"
    pub categoria: Option<String>,      // solo gastos
    pub id_usuario_destino: Option<i64> // solo sueldos
}

// OUTPUTS / ROWS
#[derive(Debug, Serialize, FromRow)]
pub struct SueldoPagoRow {
    pub id_sueldo_pago: i64,
    pub fecha_hora: String,
    pub descripcion: String,
    pub monto: i64,
    pub id_usuario_destino: Option<i64>,
    pub id_usuario: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct GastoNegocioRow {
    pub id_gasto_negocio: i64,
    pub fecha_hora: String,
    pub categoria: String,
    pub descripcion: Option<String>,
    pub monto: i64,
    pub id_usuario: i64,
}

#[derive(Debug, Serialize)]
pub struct TotalOut {
    pub total: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct SueldoPagoRowView {
    pub id_sueldo_pago: i64,
    pub fecha_hora: String,
    pub descripcion: String,
    pub monto: i64,
    pub id_usuario_destino: i64,
    pub usuario_destino_nombre: String,
}
