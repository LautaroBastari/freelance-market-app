#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EstadoCaja { Abierta, Cerrada }

impl EstadoCaja {
    pub fn as_str(self) -> &'static str {
        match self {
            EstadoCaja::Abierta => "abierta",
            EstadoCaja::Cerrada => "cerrada",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Caja {
    pub id_caja: i64,
    pub abierta_por: i64,
    pub abierta_en: String,         // podés usar chrono::DateTime si querés
    pub estado: EstadoCaja,
    pub cerrada_por: Option<i64>,
    pub cerrada_en: Option<String>,
}
