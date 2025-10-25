use serde::{Deserialize, Serialize};
use sqlx::FromRow;                // ← import

#[derive(Debug, Serialize, FromRow)]   // ← añade FromRow
pub struct Usuario {
    pub id_usuario: i64,
    pub nombre: String,
    pub nombre_usuario: String,
    pub rol: String,
    pub activo: i64,              // INTEGER en SQLite → i64 aquí
}

#[derive(Debug, Deserialize)]
pub struct UsuarioCrear {
    pub nombre: String,
    pub nombre_usuario: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct UsuarioActualizar {
    pub id_usuario: i64,
    pub nombre: Option<String>,
    pub rol: Option<String>,
    pub password_nueva: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginInput {
    pub nombre_usuario: String,
    pub password: String,
}
#[derive(Debug, Deserialize)]
pub struct ListarUsuariosParams {
    pub q: Option<String>,
    pub offset: Option<i64>,
    pub limit: Option<i64>,
}
