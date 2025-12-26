use sqlx::{SqlitePool, Sqlite, Transaction};

use crate::promos::model::{
    PromoComboCrearInput, PromoComboRow, PromoComboItemRow, PromoComboDetalle,
};

/// Prorratea total_pack proporcional al "peso" (precio_normal * cantidad), exacto sin floats
/// Devuelve (id_producto, total_asignado_al_producto)
pub(crate) fn repartir_total_proporcional(
    total_pack: i64,
    pesos: &[(i64 /*id_producto*/, i64 /*peso*/)],
) -> Result<Vec<(i64, i64)>, String> {
    if total_pack < 0 {
        return Err("precio_total_pack inválido".into());
    }
    let suma_pesos: i64 = pesos.iter().map(|(_, w)| *w).sum();
    if suma_pesos <= 0 {
        return Err("total_sugerido inválido (pesos <= 0)".into());
    }

    let mut bases: Vec<(i64, i64, i64)> = Vec::with_capacity(pesos.len()); // (id, base, resto)
    let mut suma_bases = 0i64;

    for (id, peso) in pesos {
        let numer = total_pack.saturating_mul(*peso);
        let base = numer / suma_pesos;
        let resto = numer % suma_pesos;
        bases.push((*id, base, resto));
        suma_bases += base;
    }

    let mut faltan = total_pack - suma_bases;
    bases.sort_by(|a, b| b.2.cmp(&a.2)); // mayor resto primero

    let mut out: Vec<(i64, i64)> = bases.iter().map(|(id, base, _)| (*id, *base)).collect();

    let n = out.len() as i64;
    let mut i = 0i64;
    while faltan > 0 && n > 0 {
        let idx = (i % n) as usize;
        out[idx].1 += 1;
        faltan -= 1;
        i += 1;
    }

    Ok(out)
}

/// Divide un total en qty unidades exactas sin floats.
/// Devuelve (base_unit, resto_unidades_con_plus1)
pub(crate) fn dividir_total_en_unitarios(total: i64, qty: i64) -> Result<(i64, i64), String> {
    if qty <= 0 {
        return Err("cantidad inválida".into());
    }
    if total < 0 {
        return Err("total asignado inválido".into());
    }
    Ok((total / qty, total % qty))
}

pub async fn promo_combo_crear_db(
    pool: &SqlitePool,
    input: PromoComboCrearInput,
) -> Result<i64, String> {
    if input.nombre.trim().is_empty() {
        return Err("nombre obligatorio".into());
    }
    if input.precio_min_total < 0 {
        return Err("precio_min_total inválido".into());
    }
    if input.items.is_empty() {
        return Err("el combo debe tener al menos 1 producto".into());
    }
    if input.items.iter().any(|it| it.cantidad <= 0) {
        return Err("cantidad debe ser > 0".into());
    }

    let mut tx: Transaction<'_, Sqlite> = pool.begin().await.map_err(|e| e.to_string())?;

    let res = sqlx::query(
    r#"
    INSERT INTO promo_combo (nombre, precio_pack, precio_min_total, activo)
    VALUES (?, ?, ?, 1)
    "#
    )
    .bind(input.nombre.trim())
    .bind(input.precio_pack)
    .bind(input.precio_min_total)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    let id_combo = res.last_insert_rowid();

    for it in input.items {
        sqlx::query(
            r#"
            INSERT INTO promo_combo_item (id_combo, id_producto, cantidad)
            VALUES (?1, ?2, ?3)
            "#
        )
        .bind(id_combo)
        .bind(it.id_producto)
        .bind(it.cantidad)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(id_combo)
}

pub async fn promo_combo_listar_db(
    pool: &SqlitePool,
) -> Result<Vec<PromoComboRow>, String> {
    let rows = sqlx::query_as::<_, PromoComboRow>(
        r#"
        SELECT
            id_combo,
            nombre,
            precio_pack,
            precio_min_total,
            activo,
            creado_en
        FROM promo_combo
        WHERE activo = 1
        ORDER BY id_combo DESC
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows)
}
pub async fn promo_combo_detalle_db(
    pool: &SqlitePool,
    id_combo: i64,
) -> Result<PromoComboDetalle, String> {

    // ── combo ─────────────────────────────
    let combo = sqlx::query_as::<_, PromoComboRow>(
        r#"
        SELECT
            id_combo,
            nombre,
            precio_pack,
            precio_min_total,
            activo,
            creado_en
        FROM promo_combo
        WHERE id_combo = ?
        "#
    )
    .bind(id_combo)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    // ── items ─────────────────────────────
    let items = sqlx::query_as::<_, PromoComboItemRow>(
        r#"
        SELECT
            pci.id_producto                   AS id_producto,
            p.nombre                          AS nombre,
            pci.cantidad                      AS cantidad,
            p.precio_venta_actual             AS precio_unitario,
            (p.precio_venta_actual * pci.cantidad) AS subtotal_sugerido
        FROM promo_combo_item pci
        JOIN producto p ON p.id_producto = pci.id_producto
        WHERE pci.id_combo = ?
        ORDER BY p.nombre ASC
        "#
    )
    .bind(id_combo)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let total_sugerido = items.iter().map(|i| i.subtotal_sugerido).sum();

    Ok(PromoComboDetalle {
        combo,
        items,
        total_sugerido,
    })
}