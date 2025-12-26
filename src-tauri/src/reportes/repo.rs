use sqlx::{SqlitePool, Error as SqlxError};

pub async fn perdidas_stock_periodo(
    pool: &SqlitePool,
    desde: &str,
    hasta: &str,
) -> Result<i64, SqlxError> {
    let perdidas: i64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(total_costo), 0) AS perdidas_stock
        FROM stock_mov
        WHERE fecha_hora BETWEEN ?1 AND ?2
          AND total_costo > 0
          AND (
                motivo = 'merma'
                OR (motivo = 'ajuste_absoluto_ui' AND cantidad_delta < 0)
              )
        "#,
    )
    .bind(desde)
    .bind(hasta)
    .fetch_one(pool)
    .await?;

    Ok(perdidas)
}
