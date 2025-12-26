use sqlx::{Row, Sqlite, Transaction, SqlitePool};
use uuid::Uuid;

use crate::promos::repo::{repartir_total_proporcional, dividir_total_en_unitarios};

pub async fn venta_aplicar_promo_combo_db(
    pool: &SqlitePool,
    id_venta: i64,
    id_combo: i64,
    precio_total_pack: i64,
) -> Result<String, String> {
    if precio_total_pack < 0 {
        return Err("precio_total_pack inválido".into());
    }

    let mut tx: Transaction<'_, Sqlite> = pool.begin().await.map_err(|e| e.to_string())?;

    // 1) Validar combo
    let combo_row = sqlx::query(
        r#"
        SELECT precio_min_total, activo
        FROM promo_combo
        WHERE id_combo = ?1
        "#
    )
    .bind(id_combo)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    let precio_min_total: i64 = combo_row.get(0);
    let activo: i64 = combo_row.get(1);

    if activo != 1 {
        return Err("La promoción no está activa".into());
    }
    if precio_total_pack < precio_min_total {
        return Err("El precio ingresado está por debajo del mínimo".into());
    }

    // 2) Leer items del combo + precio normal actual
    let combo_items = sqlx::query(
        r#"
        SELECT pci.id_producto, pci.cantidad, p.precio_venta_actual
        FROM promo_combo_item pci
        JOIN producto p ON p.id_producto = pci.id_producto
        WHERE pci.id_combo = ?1
        "#
    )
    .bind(id_combo)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    if combo_items.is_empty() {
        return Err("Combo sin items".into());
    }

    let mut pesos: Vec<(i64, i64)> = Vec::with_capacity(combo_items.len());
    let mut qty_por_prod: Vec<(i64, i64)> = Vec::with_capacity(combo_items.len());

    for r in &combo_items {
        let id_producto: i64 = r.get(0);
        let cantidad: i64 = r.get(1);
        let precio: i64 = r.get(2);
        let peso = precio.saturating_mul(cantidad);
        pesos.push((id_producto, peso));
        qty_por_prod.push((id_producto, cantidad));
    }

    // 3) Reparto proporcional por producto
    let asignado_por_prod = repartir_total_proporcional(precio_total_pack, &pesos)
        .map_err(|e| e.to_string())?;

    // 4) grupo id (para auditar)
    let promo_grupo_id = Uuid::new_v4().to_string();

    // 5) Consumir del carrito (venta_item) y reemplazar por líneas promo exactas
    for (id_producto, qty_necesaria) in qty_por_prod {
        let total_prod = asignado_por_prod
            .iter()
            .find(|(id, _)| *id == id_producto)
            .map(|(_, t)| *t)
            .unwrap_or(0);

        let (base_unit, resto) = dividir_total_en_unitarios(total_prod, qty_necesaria)
            .map_err(|e| e.to_string())?;

        // buscar fila sin promo con cantidad suficiente
        let fila = sqlx::query(
            r#"
            SELECT id_item, cantidad, precio_unitario, costo_unitario_en_venta
            FROM venta_item
            WHERE id_venta = ?1
              AND id_producto = ?2
              AND promo_grupo_id IS NULL
              AND promo_combo_id IS NULL
              AND cantidad >= ?3
            ORDER BY id_item DESC
            LIMIT 1
            "#
        )
        .bind(id_venta)
        .bind(id_producto)
        .bind(qty_necesaria)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        let fila = match fila {
            Some(f) => f,
            None => return Err(format!("No hay cantidad suficiente en carrito para producto {id_producto}")),
        };

        let id_item: i64 = fila.get(0);
        let cantidad_actual: i64 = fila.get(1);
        let precio_unitario_original: i64 = fila.get(2);
        let costo_unitario_en_venta: i64 = fila.get(3);

        // reducir o borrar fila original
        if cantidad_actual > qty_necesaria {
            let sobrante = cantidad_actual - qty_necesaria;
            sqlx::query(
                r#"UPDATE venta_item SET cantidad = ?1 WHERE id_item = ?2"#
            )
            .bind(sobrante)
            .bind(id_item)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        } else {
            sqlx::query(r#"DELETE FROM venta_item WHERE id_item = ?1"#)
                .bind(id_item)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
        }

        // insertar líneas promo exactas
        let qty_base = qty_necesaria - resto;

        if qty_base > 0 {
            sqlx::query(
                r#"
                INSERT INTO venta_item (
                  id_venta, id_producto, cantidad,
                  precio_unitario, costo_unitario_en_venta,
                  precio_unitario_efectivo,
                  promo_combo_id, promo_grupo_id, promo_precio_total
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#
            )
            .bind(id_venta)
            .bind(id_producto)
            .bind(qty_base)
            .bind(precio_unitario_original)
            .bind(costo_unitario_en_venta)
            .bind(base_unit)
            .bind(id_combo)
            .bind(&promo_grupo_id)
            .bind(precio_total_pack)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }

        if resto > 0 {
            sqlx::query(
                r#"
                INSERT INTO venta_item (
                  id_venta, id_producto, cantidad,
                  precio_unitario, costo_unitario_en_venta,
                  precio_unitario_efectivo,
                  promo_combo_id, promo_grupo_id, promo_precio_total
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#
            )
            .bind(id_venta)
            .bind(id_producto)
            .bind(resto)
            .bind(precio_unitario_original)
            .bind(costo_unitario_en_venta)
            .bind(base_unit + 1)
            .bind(id_combo)
            .bind(&promo_grupo_id)
            .bind(precio_total_pack)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(promo_grupo_id)
}
