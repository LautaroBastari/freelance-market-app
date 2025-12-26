use serde::Serialize;
use tauri::State;

use crate::AppState;

// Necesario para query_as::<_, T>
use sqlx::FromRow;

#[derive(Serialize, FromRow)]
pub struct VentaAdminRow {
    pub id_venta: i64,
    pub fecha_hora: String,
    pub usuario: String,
    pub id_usuario: i64,
    pub id_caja: i64,
    pub total: i64,
    pub estado: String,
}

#[derive(Serialize, FromRow)]
pub struct CajaAdminRow {
    pub id_caja: i64,
    pub abierta_por: i64,
    pub nombre_usuario: String,
    pub abierta_en: String,
    pub cerrada_en: Option<String>,
    pub estado: String,
    pub cantidad_ventas: i64,
    pub total_caja: i64,
}

#[derive(Serialize)]
pub struct AdminHistorialDia {
    pub fecha: String,
    pub id_usuario: Option<i64>,
    pub ventas: Vec<VentaAdminRow>,
    pub cajas: Vec<CajaAdminRow>,
    pub total_dia: i64,
    pub cantidad_ventas: i64,
    pub promedio_ticket: f64,
}


#[tauri::command]
pub async fn admin_historial_dia(
    state: State<'_, AppState>,
    fecha: Option<String>,   
    id_usuario: Option<i64>, 
) -> Result<AdminHistorialDia, String> {
    use sqlx::Row;

    let pool = &state.pool;

    // 1) Normalizar fecha: si no viene
    let fecha_str: String = if let Some(f) = fecha {
        f
    } else {
        let row = sqlx::query("SELECT DATE('now','localtime')")
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;
        row.try_get::<String, _>(0).map_err(|e| e.to_string())?
    };
    let ventas: Vec<VentaAdminRow> = sqlx::query_as::<_, VentaAdminRow>(
        r#"
        SELECT
          v.id_venta      AS id_venta,
          v.fecha_hora    AS fecha_hora,
          u.nombre        AS usuario,
          u.id_usuario    AS id_usuario,
          v.id_caja       AS id_caja,
          v.total         AS total,
          v.estado        AS estado
        FROM venta v
        JOIN usuario u ON u.id_usuario = v.id_usuario
        WHERE DATE(v.fecha_hora, 'localtime') = DATE(?1)
          AND v.estado = 'finalizada'
          AND (?2 IS NULL OR v.id_usuario = ?2)
        ORDER BY v.fecha_hora ASC
        "#
    )
    .bind(&fecha_str)
    .bind(id_usuario)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    // 3) Resumen del día a partir de las ventas
    let cantidad_ventas = ventas.len() as i64;
    let total_dia: i64 = ventas.iter().map(|v| v.total).sum();
    let promedio_ticket: f64 = if cantidad_ventas > 0 {
        total_dia as f64 / cantidad_ventas as f64
    } else {
        0.0
    };

    // 4) Cajas relacionadas al día
    let cajas: Vec<CajaAdminRow> = sqlx::query_as::<_, CajaAdminRow>(
        r#"
        SELECT
          c.id_caja                        AS id_caja,
          c.abierta_por                    AS abierta_por,
          u.nombre                         AS nombre_usuario,
          c.abierta_en                     AS abierta_en,
          c.cerrada_en                     AS cerrada_en,
          c.estado                         AS estado,
          (
            SELECT COUNT(*)
            FROM venta v
            WHERE v.id_caja = c.id_caja
              AND DATE(v.fecha_hora, 'localtime') = DATE(?1)
              AND v.estado = 'finalizada'
              AND (?2 IS NULL OR v.id_usuario = ?2)
          )                                AS cantidad_ventas,
          (
            SELECT COALESCE(SUM(v.total), 0)
            FROM venta v
            WHERE v.id_caja = c.id_caja
              AND DATE(v.fecha_hora, 'localtime') = DATE(?1)
              AND v.estado = 'finalizada'
              AND (?2 IS NULL OR v.id_usuario = ?2)
          )                                AS total_caja
        FROM caja c
        JOIN usuario u ON u.id_usuario = c.abierta_por
        WHERE
          (
            DATE(c.abierta_en, 'localtime') = DATE(?1)
            OR (
              c.cerrada_en IS NOT NULL
              AND DATE(c.cerrada_en, 'localtime') = DATE(?1)
            )
          )
          AND (?2 IS NULL OR c.abierta_por = ?2)
        ORDER BY c.abierta_en ASC
        "#
    )
    .bind(&fecha_str)
    .bind(id_usuario)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(AdminHistorialDia {
        fecha: fecha_str,
        id_usuario,
        ventas,
        cajas,
        total_dia,
        cantidad_ventas,
        promedio_ticket,
    })
}
