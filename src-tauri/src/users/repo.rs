use anyhow::{anyhow, Result};
use sqlx::SqlitePool;
use crate::users::model::*;
use crate::users::crypto::hash_password;

// CREATE
pub async fn crear(pool: &SqlitePool, i: &UsuarioCrear, rol_fijo: &str) -> Result<i64> {
    if i.nombre_usuario.trim().is_empty() { return Err(anyhow!("nombre_usuario vacío")); }
    if i.nombre.trim().is_empty()         { return Err(anyhow!("nombre vacío")); }
    if i.password.is_empty()              { return Err(anyhow!("password vacío")); }

    // rol viene fijo desde commands; si es inválido, forzá 'operador'
    let rol = match rol_fijo {
        "operador" | "admin" => rol_fijo,
        _ => "operador",
    };

    let hash = hash_password(&i.password)?;

    // IMPORTANTE: insertá en 'rol_tipo' y no te confundas con los índices (? ? ? ?).
    let res = sqlx::query(
        r#"
        INSERT INTO usuario (nombre, nombre_usuario, rol_tipo, clave_hash, activo)
        VALUES (?, ?, ?, ?, 1)
        "#
    )
    .bind(&i.nombre)
    .bind(&i.nombre_usuario)
    .bind(rol)
    .bind(hash)
    .execute(pool)
    .await?;

    Ok(res.last_insert_rowid())
}

// READ (uno)
pub async fn obtener(pool: &SqlitePool, id: i64) -> Result<Usuario> {
    // Alias: rol_tipo AS rol, para mapear al struct Usuario { rol: String }
    let u = sqlx::query_as::<_, Usuario>(
        r#"
        SELECT id_usuario, nombre, nombre_usuario, rol_tipo AS rol, activo
        FROM usuario
        WHERE id_usuario = ?
        "#
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(u)
}

// READ (lista)
pub async fn listar(pool: &SqlitePool, p: ListarUsuariosParams) -> Result<Vec<Usuario>> {
    let q = p.q.unwrap_or_default();

    if q.is_empty() {
        let rows = sqlx::query_as::<_, Usuario>(
            r#"
            SELECT id_usuario, nombre, nombre_usuario, rol_tipo AS rol, activo
            FROM usuario
            ORDER BY id_usuario DESC
            LIMIT ? OFFSET ?
            "#
        )
        .bind(p.limit.unwrap_or(50))
        .bind(p.offset.unwrap_or(0))
        .fetch_all(pool)
        .await?;
        return Ok(rows);
    }

    let q_like = format!("%{}%", q.to_lowercase());
    let rows = sqlx::query_as::<_, Usuario>(
        r#"
        SELECT id_usuario, nombre, nombre_usuario, rol_tipo AS rol, activo
        FROM usuario
        WHERE lower(nombre) LIKE ? OR lower(nombre_usuario) LIKE ?
        ORDER BY id_usuario DESC
        LIMIT ? OFFSET ?
        "#
    )
    .bind(&q_like)
    .bind(&q_like)
    .bind(p.limit.unwrap_or(50))
    .bind(p.offset.unwrap_or(0))
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

// UPDATE
pub async fn actualizar(pool: &SqlitePool, u: UsuarioActualizar) -> Result<()> {
    let mut sets: Vec<&str> = Vec::new();
    let mut params: Vec<String> = Vec::new();

    if let Some(n) = u.nombre { sets.push("nombre = ?");    params.push(n); }
    if let Some(r) = u.rol    { sets.push("rol_tipo = ?");  params.push(r); }

    if let Some(pw) = u.password_nueva {
        let hash = hash_password(&pw)?;
        sets.push("clave_hash = ?");
        params.push(hash);
    }

    if sets.is_empty() { return Ok(()); }

    let sql = format!("UPDATE usuario SET {} WHERE id_usuario = ?", sets.join(", "));
    let mut q = sqlx::query(&sql);
    for v in params { q = q.bind(v); }
    q = q.bind(u.id_usuario);
    q.execute(pool).await?;
    Ok(())
}

pub async fn obtener_credenciales(pool: &SqlitePool, nombre_usuario: &str)
    -> Result<(i64, String, i64)> // (id_usuario, clave_hash, activo)
{
    let row = sqlx::query_as::<_, (i64, String, i64)>(
        r#"
        SELECT id_usuario, clave_hash, activo
        FROM usuario
        WHERE nombre_usuario = ?
        "#
    )
    .bind(nombre_usuario)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

// DELETE
pub async fn eliminar(pool: &SqlitePool, id: i64) -> Result<()> {
    sqlx::query("DELETE FROM usuario WHERE id_usuario = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
