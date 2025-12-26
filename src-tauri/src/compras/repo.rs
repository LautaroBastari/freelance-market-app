use sqlx::{SqlitePool, Result};

pub async fn registrar_compra_repo(
    pool: &SqlitePool,
    id_producto: i64,
    cantidad: i64,
    costo_unitario: i64,
    referencia: Option<String>,
    mantener_costo: bool,
) -> Result<()> {
    let mut tx = pool.begin().await?;

    // Determinar el costo que realmente se usara
    let costo_efectivo: i64 = if mantener_costo {
        sqlx::query_scalar::<_, i64>(
            "SELECT costo_actual FROM producto WHERE id_producto = ?1"
        )
        .bind(id_producto)
        .fetch_one(&mut *tx)
        .await?
    } else {
        costo_unitario
    };

    //  Registrar movimiento de stock (compra)
    sqlx::query(
        r#"
        INSERT INTO stock_mov (
            id_producto,
            cantidad_delta,
            motivo,
            referencia,
            costo_unitario,
            fecha_hora
        )
        VALUES (?1, ?2, 'compra', ?3, ?4, DATETIME('now','localtime'))
        "#
    )
    .bind(id_producto)
    .bind(cantidad)
    .bind(referencia)
    .bind(costo_efectivo)
    .execute(&mut *tx)
    .await?;

    // 3) Actualizar costo_actual solo si NO marcó "mantener costo"
    if !mantener_costo {
        sqlx::query(
            r#"
            UPDATE producto
            SET costo_actual = ?1
            WHERE id_producto = ?2
            "#
        )
        .bind(costo_efectivo)
        .bind(id_producto)
        .execute(&mut *tx)
        .await?;
    }

    // El stock_actual lo manejan tus TRIGGERS sobre stock_mov
    tx.commit().await?;
    Ok(())
}
