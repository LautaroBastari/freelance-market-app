use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TipoPrecio { Venta, Costo }

impl TipoPrecio {
    pub fn as_str(self) -> &'static str {
        match self { TipoPrecio::Venta => "venta", TipoPrecio::Costo => "costo" }
    }
}
// conversión segura desde string
impl TryFrom<&str> for TipoPrecio {
    type Error = ();
    fn try_from(s: &str) -> Result<Self, ()> {
        match s {
            "venta" => Ok(TipoPrecio::Venta),
            "costo" => Ok(TipoPrecio::Costo),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Serialize)]  // ⬅️ importante
pub struct StockResumen {
    pub id_producto: i64,
    pub codigo_producto: String,
    pub nombre: String,
    pub precio_venta_actual: i64,
    pub costo_actual: i64,
    pub stock_actual: i64,
    pub actualizado_en: String,
    pub activo: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct StockMovDTO {
    pub id_movimiento: i64,
    pub cantidad_delta: i64,
    pub motivo: String,
    pub referencia: Option<String>,
    pub fecha_hora: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PrecioHistDTO {
    pub id_precio: i64,
    pub tipo: String, // "venta" | "costo"
    pub precio: i64,
    pub vigente_desde: String,
    pub vigente_hasta: Option<String>,
}

// Si algún comando devuelve Producto, también:
#[derive(Debug, Clone, Serialize)]
pub struct Producto {
    pub id_producto: i64,
    pub codigo_producto: String,
    pub nombre: String,
    pub precio_venta_actual: i64,
    pub costo_actual: i64,
    pub activo: i64,
}
