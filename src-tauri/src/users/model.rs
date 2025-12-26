use serde::{Deserialize, Serialize};
use sqlx::FromRow;                

#[derive(Debug, Serialize, FromRow)]   
pub struct Usuario {
    pub id_usuario: i64,
    pub nombre: String,
    pub nombre_usuario: String,
    pub rol: String,
    pub activo: i64,             
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


#[derive(Serialize, Debug, Clone, FromRow)]
pub struct UsuarioOpcionSueldo {
    pub id_usuario: i64,
    pub nombre: String,
    pub rol_tipo: String,
    pub activo: i64,
}

#[derive(Serialize, Debug, Clone, FromRow)]
pub struct UsuarioOpcion {
    pub id_usuario: i64,
    pub nombre: String,
}