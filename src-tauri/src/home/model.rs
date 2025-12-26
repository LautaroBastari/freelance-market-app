use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct AdminHomeAlerta {
    pub nivel: String, 
    pub texto: String,
}

#[derive(Serialize, Clone)]
pub struct AdminHomeTopProductoHoy {
    pub id_producto: i64,
    pub nombre: String,
    pub cantidad: i64,
    pub recaudado: i64,
}

#[derive(Serialize, Clone)]
pub struct AdminHomeResumen {
    pub ventas_hoy_total: i64,
    pub ventas_hoy_cant: i64,
    pub resultado_mes_neto: i64,
    pub stock_critico_cant: i64,
    pub top_producto_hoy: Option<AdminHomeTopProductoHoy>,
    pub alertas: Vec<AdminHomeAlerta>,
}
