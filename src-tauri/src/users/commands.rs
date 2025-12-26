use serde::Serialize;
use sqlx::Row;
use tauri::State;

use crate::{
    AppState,
    users::{
        crypto::{hash_password, verify_password},
        model::*,
        repo,
    },
};

fn norm_username(s: &str) -> String {
    s.trim().to_lowercase()
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear usuario (usa repo::crear + normaliza nombre_usuario)
#[tauri::command(rename = "usuario_crear")]
pub async fn usuario_crear(state: State<'_, AppState>, input: UsuarioCrear) -> Result<i64, String> {
    // Rol fijo en este command
    repo::crear(&state.pool, &input, "operador")
        .await
        .map_err(|e| e.to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener / listar
#[tauri::command]
pub async fn usuario_obtener(
    state: State<'_, AppState>,
    id_usuario: i64,
) -> Result<Usuario, String> {
    repo::obtener(&state.pool, id_usuario)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn usuario_listar(
    state: State<'_, AppState>,
    params: ListarUsuariosParams,
) -> Result<Vec<Usuario>, String> {
    repo::listar(&state.pool, params)
        .await
        .map_err(|e| e.to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// Login (case-insensitive por normalización)
#[tauri::command]
pub async fn login(state: State<'_, AppState>, input: LoginInput) -> Result<bool, String> {
    if input.nombre_usuario.trim().is_empty() || input.password.is_empty() {
        return Err("Datos inválidos".into());
    }

    // Normalizamos SIEMPRE (ignorar mayúsculas/minúsculas)
    let nombre_usuario = norm_username(&input.nombre_usuario);

    // Credenciales por repo (ya normaliza también, pero acá queda explícito)
    let (id_usuario, hash, activo) = repo::obtener_credenciales(&state.pool, &nombre_usuario)
        .await
        .map_err(|_| "Usuario inexistente".to_string())?;

    if activo != 1 {
        return Err("Usuario inactivo".into());
    }

    let ok = verify_password(&input.password, &hash)
        .map_err(|_| "Error al verificar contraseña".to_string())?;

    if !ok {
        return Err("Contraseña incorrecta".into());
    }

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
    pub rol: String,      // normalizado a minúsculas
    pub rol_tipo: String, // crudo en BD
}

#[derive(Serialize, Debug, Clone)]
pub struct UsuarioActualOut {
    pub id_usuario: i64,
    pub nombre: String,
    pub rol_tipo: String, // crudo en BD
}

async fn has_rol_tipo(pool: &sqlx::SqlitePool) -> Result<bool, String> {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM pragma_table_info('usuario') WHERE name='rol_tipo')",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())
}

async fn get_rol_raw(pool: &sqlx::SqlitePool, id_usuario: i64) -> Result<String, String> {
    if has_rol_tipo(pool).await? {
        let row = sqlx::query("SELECT rol_tipo FROM usuario WHERE id_usuario = ?1")
            .bind(id_usuario)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;
        row.try_get::<String, _>("rol_tipo").map_err(|e| e.to_string())
    } else {
        let row = sqlx::query("SELECT rol FROM usuario WHERE id_usuario = ?1")
            .bind(id_usuario)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;
        row.try_get::<String, _>("rol").map_err(|e| e.to_string())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// session_info
#[tauri::command]
pub async fn session_info(state: State<'_, AppState>) -> Result<SessionOut, String> {
    let maybe_id = state
        .session_user
        .lock()
        .map_err(|_| "lock".to_string())?
        .clone();

    let id = maybe_id.ok_or_else(|| "No hay sesión".to_string())?;

    let rol_tipo_str = get_rol_raw(&state.pool, id).await?;
    let rol_norm = rol_tipo_str.trim().to_lowercase();

    Ok(SessionOut {
        usuarioId: id,
        rol: rol_norm,
        rol_tipo: rol_tipo_str,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// usuario_actual
#[tauri::command]
pub async fn usuario_actual(state: State<'_, AppState>) -> Result<UsuarioActualOut, String> {
    let maybe_id = state
        .session_user
        .lock()
        .map_err(|_| "lock".to_string())?
        .clone();

    let id = maybe_id.ok_or_else(|| "No hay sesión".to_string())?;

    if has_rol_tipo(&state.pool).await? {
        let row = sqlx::query("SELECT nombre, rol_tipo FROM usuario WHERE id_usuario = ?1")
            .bind(id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| e.to_string())?;

        let nombre: String = row.try_get("nombre").map_err(|e| e.to_string())?;
        let rol_tipo: String = row.try_get("rol_tipo").map_err(|e| e.to_string())?;

        Ok(UsuarioActualOut {
            id_usuario: id,
            nombre,
            rol_tipo,
        })
    } else {
        let row = sqlx::query("SELECT nombre, rol FROM usuario WHERE id_usuario = ?1")
            .bind(id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| e.to_string())?;

        let nombre: String = row.try_get("nombre").map_err(|e| e.to_string())?;
        let rol_tipo: String = row.try_get("rol").map_err(|e| e.to_string())?;

        Ok(UsuarioActualOut {
            id_usuario: id,
            nombre,
            rol_tipo,
        })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Logout
#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(mut guard) = state.session_user.lock() {
        *guard = None;
    }
    Ok(())
}

#[tauri::command]
pub async fn usuario_listar_opciones(state: State<'_, AppState>) -> Result<Vec<UsuarioOpcion>, String> {
    repo::listar_opciones(&state.pool)
        .await
        .map_err(|e| e.to_string())
}
