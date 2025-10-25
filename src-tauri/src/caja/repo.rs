use sqlx::{SqlitePool, Row};
use crate::caja::model::{Caja, EstadoCaja};

pub async fn existe_caja_abierta(pool: &SqlitePool) -> Result<bool, sqlx::Error> {
    let ok: Option<i64> = sqlx::query_scalar(
        "SELECT 1 FROM caja WHERE estado='abierta' LIMIT 1"
    ).fetch_optional(pool).await?;
    Ok(ok.is_some())
}

pub async fn abrir_caja(pool: &SqlitePool, user_id: i64) -> Result<i64, sqlx::Error> {
    let res = sqlx::query(
        "INSERT INTO caja (abierta_por, estado, abierta_en)
            VALUES (?1,'abierta',DATETIME('now','localtime'));"
    )
    .bind(user_id)
    .execute(pool).await?;
    Ok(res.last_insert_rowid())
}

pub async fn ultima_caja_abierta_id(pool: &SqlitePool) -> Result<Option<i64>, sqlx::Error> {
    let id: Option<i64> = sqlx::query_scalar(
        "SELECT id_caja FROM caja
         WHERE estado='abierta'
         ORDER BY id_caja DESC LIMIT 1"
    ).fetch_optional(pool).await?;
    Ok(id)
}

pub async fn cerrar_caja(pool: &SqlitePool, id_caja: i64, user_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE caja
                SET estado='cerrada',
                    cerrada_en=DATETIME('now','localtime'),
                    cerrada_por=?1
                WHERE id_caja=?2 AND estado='abierta';"
    )
    .bind(user_id)
    .bind(id_caja)
    .execute(pool).await?;
    Ok(())
}

/// (Opcional) obtener una caja ya persistida
pub async fn obtener_caja(pool: &SqlitePool, id_caja: i64) -> Result<Option<Caja>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT id_caja, abierta_por, abierta_en, estado, cerrada_por, cerrada_en
           FROM caja
          WHERE id_caja=?1"
    )
    .bind(id_caja)
    .fetch_optional(pool).await?;

    Ok(row.map(|r| Caja{
        id_caja: r.get("id_caja"),
        abierta_por: r.get("abierta_por"),
        abierta_en: r.get::<String,_>("abierta_en"),
        estado: match r.get::<String,_>("estado").as_str() {
            "abierta" => EstadoCaja::Abierta,
            _ => EstadoCaja::Cerrada,
        },
        cerrada_por: r.try_get("cerrada_por").ok(),
        cerrada_en: r.try_get("cerrada_en").ok(),
    }))
}
