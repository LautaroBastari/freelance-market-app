use tauri::State;
use serde::{Deserialize, Serialize};
use crate::app_state::AppState;
use crate::users::auth::AuthState;
use crate::caja::repo;
use sqlx::Row;

// UTILIDADES

#[tauri::command]
pub async fn ping_inline() -> &'static str { "pong" }

fn read_uid(auth: &AuthState, state: &AppState) -> Option<i64> {
    //  Intentar desde AuthState
    if let Ok(g) = auth.current_user_id.read() {
        if g.is_some() { return *g; }
    }
    if let Ok(g) = state.session_user.lock() {
        *g
    } else {
        None
    }
}

// CONSULTAS BÁSICAS

#[tauri::command]
pub async fn caja_esta_abierta(state: State<'_, AppState>) -> Result<bool, String> {
    repo::existe_caja_abierta(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn caja_estado(state: State<'_, AppState>) -> Result<bool, String> {
    let id = sqlx::query_scalar::<_, i64>(
        "SELECT id_caja FROM caja WHERE estado='abierta' LIMIT 1"
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(id.is_some())
}

// ABRIR CAJA

#[derive(Serialize)]
pub struct CajaAbrirOut { pub id_caja: i64 }

#[tauri::command]
pub async fn caja_abrir(
    state: State<'_, AppState>,
    auth: State<'_, AuthState>
) -> Result<CajaAbrirOut, String> {

    let uid = read_uid(&auth, &state)
        .ok_or_else(|| "Tenés que iniciar sesión para abrir caja".to_string())?;

    // Si ya hay caja abierta, la cerramos automáticamente
    if repo::existe_caja_abierta(&state.pool).await.map_err(|e| e.to_string())? {
        if let Some(id) = repo::ultima_caja_abierta_id(&state.pool)
            .await.map_err(|e| e.to_string())? 
        {
            repo::cerrar_caja(&state.pool, id, uid)
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    let id_nueva = repo::abrir_caja(&state.pool, uid)
        .await
        .map_err(|e| e.to_string())?;

    Ok(CajaAbrirOut { id_caja: id_nueva })
}

// CERRAR CAJA INDIVIDUAL

#[derive(Serialize)]
pub struct CajaCerrarOut { pub id_caja: i64 }

#[tauri::command]
pub async fn caja_cerrar(
    state: State<'_, AppState>,
    auth: State<'_, AuthState>
) -> Result<CajaCerrarOut, String> {

    let uid = read_uid(&auth, &state)
        .ok_or_else(|| "Tenés que iniciar sesión para cerrar la caja".to_string())?;

    let id = repo::ultima_caja_abierta_id(&state.pool)
        .await.map_err(|e| e.to_string())?
        .ok_or_else(|| "No hay caja abierta".to_string())?;

    repo::cerrar_caja(&state.pool, id, uid)
        .await
        .map_err(|e| e.to_string())?;

    Ok(CajaCerrarOut { id_caja: id })
}


//  NUEVO — RESUMEN DIARIO DEL USUARIO


#[derive(Serialize)]
pub struct MedioPagoResumen {
    pub medio: String,
    pub total_medio: i64,
}

#[derive(Serialize)]
pub struct CajaResumenDiario {
    pub id_cajas: Vec<i64>,
    pub cantidad_cajas: i32,
    pub cantidad_ventas: i32,
    pub total_general: i64,
    pub por_medio: Vec<MedioPagoResumen>,
}

#[tauri::command]
pub async fn caja_resumen_diario(
    state: State<'_, AppState>,
    auth: State<'_, AuthState>
) -> Result<CajaResumenDiario, String> {

    let uid = read_uid(&auth, &state)
        .ok_or_else(|| "Tenés que iniciar sesión.".to_string())?;

    // cajas del día
    let cajas = sqlx::query(
        r#"
        SELECT id_caja
        FROM caja
        WHERE abierta_por = ?
          AND abierta_en >= datetime('now','localtime','start of day')
          AND abierta_en <  datetime('now','localtime','start of day','+1 day')
        "#)
        .bind(uid)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let id_cajas: Vec<i64> = cajas.iter().map(|r| r.get::<i64,_>("id_caja")).collect();

    //  total ventas finalizadas del día
    let ventas_count: i32 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM venta
        WHERE id_usuario = ?
          AND estado='finalizada'
          AND fecha_hora >= datetime('now','localtime','start of day')
          AND fecha_hora <  datetime('now','localtime','start of day','+1 day')
        "#)
        .bind(uid)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let total_general: i64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(vp.monto),0)
        FROM venta v
        JOIN venta_pago vp ON vp.id_venta = v.id_venta
        WHERE v.id_usuario = ?
          AND v.estado='finalizada'
          AND v.fecha_hora >= datetime('now','localtime','start of day')
          AND v.fecha_hora <  datetime('now','localtime','start of day','+1 day')
        "#)
        .bind(uid)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let pagos = sqlx::query(
        r#"
        SELECT vp.medio AS medio,
               SUM(vp.monto) AS total_medio
        FROM venta v
        JOIN venta_pago vp ON vp.id_venta = v.id_venta
        WHERE v.id_usuario = ?
          AND v.estado='finalizada'
          AND v.fecha_hora >= datetime('now','localtime','start of day')
          AND v.fecha_hora <  datetime('now','localtime','start of day','+1 day')
        GROUP BY vp.medio
        "#)
        .bind(uid)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let por_medio = pagos.into_iter().map(|r| MedioPagoResumen {
        medio: r.get("medio"),
        total_medio: r.get("total_medio"),
    }).collect();

    let cantidad_cajas = id_cajas.len() as i32;

    Ok(CajaResumenDiario {
        id_cajas,
        cantidad_cajas,
        cantidad_ventas: ventas_count,
        total_general,
        por_medio,
    })
}

// NUEVO — CERRAR TODAS LAS CAJAS DEL DÍA DEL USUARIO

#[derive(Deserialize)]
pub struct CierreDiarioInput {
    pub id_cajas: Vec<i64>,
}

#[tauri::command]
pub async fn caja_cerrar_diario(
    state: State<'_, AppState>,
    auth: State<'_, AuthState>,
    input: CierreDiarioInput
) -> Result<(), String> {

    let uid = read_uid(&auth, &state)
        .ok_or_else(|| "Tenés que iniciar sesión.".to_string())?;

    for id in input.id_cajas {
        repo::cerrar_caja(&state.pool, id, uid)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// LOGOUT
#[tauri::command]
pub async fn auth_logout(auth: State<'_, AuthState>) -> Result<(), String> {
    *auth.current_user_id.write().map_err(|_| "lock")? = None;
    Ok(())
}
