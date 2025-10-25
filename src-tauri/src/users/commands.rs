use tauri::State;
use sqlx::Row;
use serde::Serialize;

use crate::{
    AppState,
    users::{model::*, repo, crypto::{verify_password, hash_password}},
};

// ─────────────────────────────────────────────────────────────────────────────
// Crear usuario (respeta si la tabla tiene `rol_tipo` o `rol`)
#[tauri::command(rename = "usuario_crear")]
pub async fn usuario_crear(state: State<'_, AppState>, input: UsuarioCrear) -> Result<i64, String> {
    let pool = &state.pool;
    let hash = hash_password(&input.password).map_err(|e| e.to_string())?;

    // ¿Existe 'rol_tipo'?
    let has_rol_tipo: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM pragma_table_info('usuario') WHERE name='rol_tipo')"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let rol = "operador";

    let sql = if has_rol_tipo {
        "INSERT INTO usuario (nombre, nombre_usuario, clave_hash, rol_tipo, activo)
         VALUES (?1, ?2, ?3, ?4, 1)"
    } else {
        "INSERT INTO usuario (nombre, nombre_usuario, clave_hash, rol, activo)
         VALUES (?1, ?2, ?3, ?4, 1)"
    };

    let res = sqlx::query(sql)
        .bind(&input.nombre)
        .bind(&input.nombre_usuario)
        .bind(&hash)
        .bind(rol)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(res.last_insert_rowid())
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener / listar
#[tauri::command]
pub async fn usuario_obtener(state: State<'_, AppState>, id_usuario: i64) -> Result<Usuario, String> {
    repo::obtener(&state.pool, id_usuario).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn usuario_listar(state: State<'_, AppState>, params: ListarUsuariosParams) -> Result<Vec<Usuario>, String> {
    repo::listar(&state.pool, params).await.map_err(|e| e.to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// Login: valida y guarda SOLO el id en la sesión (no tocamos tu AuthState)
#[tauri::command]
pub async fn login(state: State<'_, AppState>, input: LoginInput) -> Result<bool, String> {
    if input.nombre_usuario.trim().is_empty() || input.password.is_empty() {
        return Err("Datos inválidos".into());
    }

    // Buscar el usuario
    let row_opt = sqlx::query_as::<_, (i64, String, i64)>(
        "SELECT id_usuario, clave_hash, activo FROM usuario WHERE nombre_usuario = ?"
    )
    .bind(&input.nombre_usuario)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    // Caso: usuario inexistente
    let (id_usuario, hash, activo) = match row_opt {
        Some(row) => row,
        None => return Err("Usuario inexistente".into()),
    };

    if activo != 1 {
        return Err("Usuario inactivo".into());
    }

    // Verificar contraseña
    let ok = verify_password(&input.password, &hash)
        .map_err(|_| "Error al verificar contraseña".to_string())?;

    if !ok {
        return Err("Contraseña incorrecta".into());
    }

    // Guardar sesión (id)
    if let Ok(mut guard) = state.session_user.lock() {
        *guard = Some(id_usuario);
    }

    Ok(true)
}

// ─────────────────────────────────────────────────────────────────────────────
// Estructuras de salida para sesión/usuario actual
#[derive(Serialize, Debug, Clone)]
pub struct SessionOut {
    pub usuarioId: i64,
    pub rol: String,      // "admin" / "operador" (normalizado a minúsculas)
    pub rol_tipo: String, // valor crudo tal como está en la tabla
}

#[derive(Serialize, Debug, Clone)]
pub struct UsuarioActualOut {
    pub id_usuario: i64,
    pub nombre: String,
    pub rol_tipo: String, // crudo en BD
}

// ─────────────────────────────────────────────────────────────────────────────
// session_info: desde el id en sesión, lee el rol de la BD y lo devuelve
#[tauri::command]
pub async fn session_info(state: State<'_, AppState>) -> Result<SessionOut, String> {
    let maybe_id = state.session_user
        .lock()
        .map_err(|_| "lock".to_string())?
        .clone();

    let id = maybe_id.ok_or_else(|| "No hay sesión".to_string())?;

    // ¿La tabla tiene 'rol_tipo'?
    let has_rol_tipo: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM pragma_table_info('usuario') WHERE name='rol_tipo')"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    // Leemos el rol (sea 'rol_tipo' o 'rol') y lo normalizamos
    let rol_tipo_str: String = if has_rol_tipo {
        sqlx::query("SELECT rol_tipo FROM usuario WHERE id_usuario = ?1")
            .bind(id)
            .fetch_one(&state.pool).await
            .map_err(|e| e.to_string())?
            .try_get::<String, _>("rol_tipo")
            .map_err(|e| e.to_string())?
    } else {
        sqlx::query("SELECT rol FROM usuario WHERE id_usuario = ?1")
            .bind(id)
            .fetch_one(&state.pool).await
            .map_err(|e| e.to_string())?
            .try_get::<String, _>("rol")
            .map_err(|e| e.to_string())?
    };

    let rol_norm = rol_tipo_str.trim().to_lowercase(); // "admin" / "operador"

    Ok(SessionOut {
        usuarioId: id,
        rol: rol_norm,
        rol_tipo: rol_tipo_str,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// usuario_actual (opcional, por si lo necesitás en el front)
#[tauri::command]
pub async fn usuario_actual(state: State<'_, AppState>) -> Result<UsuarioActualOut, String> {
    let maybe_id = state.session_user
        .lock()
        .map_err(|_| "lock".to_string())?
        .clone();

    let id = maybe_id.ok_or_else(|| "No hay sesión".to_string())?;

    // Trae nombre y rol (columna que exista)
    let has_rol_tipo: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM pragma_table_info('usuario') WHERE name='rol_tipo')"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if has_rol_tipo {
        let row = sqlx::query("SELECT nombre, rol_tipo FROM usuario WHERE id_usuario = ?1")
            .bind(id)
            .fetch_one(&state.pool).await
            .map_err(|e| e.to_string())?;
        let nombre: String = row.try_get("nombre").map_err(|e| e.to_string())?;
        let rol_tipo: String = row.try_get("rol_tipo").map_err(|e| e.to_string())?;
        Ok(UsuarioActualOut { id_usuario: id, nombre, rol_tipo })
    } else {
        let row = sqlx::query("SELECT nombre, rol FROM usuario WHERE id_usuario = ?1")
            .bind(id)
            .fetch_one(&state.pool).await
            .map_err(|e| e.to_string())?;
        let nombre: String = row.try_get("nombre").map_err(|e| e.to_string())?;
        let rol_tipo: String = row.try_get("rol").map_err(|e| e.to_string())?;
        Ok(UsuarioActualOut { id_usuario: id, nombre, rol_tipo })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Logout
#[tauri::command]
pub async fn logout(state: tauri::State<'_, AppState>) -> Result<(), String> {
    if let Ok(mut guard) = state.session_user.lock() {
        *guard = None;
    }
    Ok(())
}
