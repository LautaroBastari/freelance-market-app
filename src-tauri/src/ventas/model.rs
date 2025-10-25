use serde::{Serialize, Deserialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ProductoDisponible {
    pub id_producto: i64,
    pub nombre: String,
    pub precio_unitario: i64,
    pub stock_disponible: i64,
}

#[derive(Debug, Deserialize)]
pub struct VentaLineaInput {
    pub id_producto: i64,
    pub cantidad: i64, // INTEGER > 0
}

