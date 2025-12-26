use serde::{Deserialize, Serialize};
use sqlx::FromRow;
#[derive(Debug, Deserialize)]
pub struct PromoComboItemInput {
    pub id_producto: i64,
    pub cantidad: i64,
}

#[derive(Debug, Deserialize)]
pub struct PromoComboCrearInput {
    pub nombre: String,
    pub precio_pack: i64,
    pub precio_min_total: i64,
    pub items: Vec<PromoComboItemInput>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct PromoComboRow {
    pub id_combo: i64,
    pub nombre: String,
    pub precio_pack: i64,
    pub precio_min_total: i64,
    pub activo: i64,
    pub creado_en: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct PromoComboItemRow {
    pub id_producto: i64,
    pub nombre: String,
    pub cantidad: i64,
    pub precio_unitario: i64,
    pub subtotal_sugerido: i64,
}

#[derive(Debug, Serialize)]
pub struct PromoComboDetalle {
    pub combo: PromoComboRow,
    pub items: Vec<PromoComboItemRow>,
    pub total_sugerido: i64,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct PromoComboListadoRow {
    pub id_combo: i64,
    pub nombre: String,
    pub precio_pack: i64,
    pub precio_min_total: i64,
    pub activo: i64,
    pub resumen: String,
}
