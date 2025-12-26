use tauri::State;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use crate::AppState;
use super::{repo, model::PromoComboAplicarInput};

#[derive(sqlx::FromRow, serde::Serialize)]
pub struct ProductoDisponible {
    pub id_producto: i64,
    pub nombre: String,
    pub precio_unitario: i64,
    pub stock_disponible: i64,
}

#[derive(sqlx::FromRow, serde::Serialize)]
pub struct VentaItemDto {
    pub id_item: i64,
    pub id_producto: i64,
    pub nombre: String,
    pub cantidad: i64,
    pub precio_unitario: i64,
    pub subtotal: i64,
}

#[derive(serde::Deserialize)]
pub struct AgregarItemInput {
    pub id_venta: i64,
    pub id_producto: i64,
    pub cantidad: i64,
}

#[derive(serde::Deserialize)]
pub struct SetCantidadInput {
    pub id_item: i64,
    pub cantidad: i64,
}

#[derive(serde::Deserialize)]
pub struct QuitarItemInput {
    pub id_item: i64,
}

#[derive(serde::Deserialize)]
pub struct VentaListarInput {
    pub id_venta: i64,
}

#[derive(serde::Deserialize)]
pub struct VentaCancelarInput {
    pub id_venta: i64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PagoInput {
    pub medio: String,
    pub monto: i64,
    pub referencia: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct VentaFinalizarInput {
    pub id_venta: i64,
    pub pagos: Vec<PagoInput>,
}

#[derive(sqlx::FromRow, serde::Serialize)]
pub struct HistorialItem {
    pub id_venta: i64,
    pub hora: String,
    pub codigo_producto: String,
    pub producto: String,
    pub cantidad: i64,
    pub precio_unitario: i64,
    pub subtotal: i64,
    pub total_venta: i64,
    pub pagos_detalle: Option<String>,
}



#[tauri::command]
pub async fn productos_disponibles(
    state: State<'_, AppState>,
) -> Result<Vec<ProductoDisponible>, String> {
    let rows = sqlx::query_as::<_, ProductoDisponible>(
        r#"
        SELECT
          p.id_producto AS id_producto,
          p.nombre      AS nombre,
          COALESCE(
            (SELECT ph.precio
               FROM precio_historial ph
              WHERE ph.id_producto = p.id_producto
                AND ph.tipo = 'venta'
                AND ph.vigente_hasta IS NULL
              ORDER BY ph.vigente_desde DESC
              LIMIT 1),
            p.precio_venta_actual
          )                          AS precio_unitario,
          COALESCE(ps.stock_actual,0) AS stock_disponible
        FROM producto p
        LEFT JOIN producto_stock ps ON ps.id_producto = p.id_producto
        WHERE p.activo = 1
        ORDER BY p.nombre
        "#
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows)
}



#[tauri::command]
pub async fn venta_iniciar(state: State<'_, AppState>) -> Result<i64, String> {
    let uid = *state
        .session_user
        .lock()
        .map_err(|_| "lock")?
        .as_ref()
        .ok_or("No hay sesión")?;

    let id_caja = sqlx::query_scalar::<_, i64>(
        "SELECT id_caja FROM caja WHERE estado='abierta' LIMIT 1",
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("No hay caja abierta")?;

    let res = sqlx::query(
        "INSERT INTO venta(id_usuario, id_caja, fecha_hora, total, estado)
         VALUES(?, ?, DATETIME('now','localtime'), 0, 'en_curso')"
    )
    .bind(uid)
    .bind(id_caja)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(res.last_insert_rowid())
}

// Agregar ítem al carrito. El stock se impacta al finalizar la venta.
#[tauri::command]
pub async fn venta_agregar_item(
    state: State<'_, AppState>,
    input: AgregarItemInput,
) -> Result<(), String> {
    if input.cantidad <= 0 {
        return Err("Cantidad inválida".into());
    }

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // ya existe una línea para este producto en esta venta?
    let existente = sqlx::query(
        "SELECT id_item, cantidad, precio_unitario
        FROM venta_item
        WHERE id_venta = ? 
            AND id_producto = ?
            AND fuente_precio = 'catalogo'
        LIMIT 1",
    )
    .bind(input.id_venta)
    .bind(input.id_producto)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    if let Some(row) = existente {
        // Ya hay línea: sumamos cantidad
        let id_item: i64 = row.get("id_item");
        let cantidad_actual: i64 = row.get("cantidad");
        let precio_unitario: i64 = row.get("precio_unitario");

        let nueva_cantidad = cantidad_actual + input.cantidad;
        let nuevo_subtotal = nueva_cantidad * precio_unitario;

        sqlx::query(
            "UPDATE venta_item
                SET cantidad = ?,
                    subtotal = ?
              WHERE id_item = ?",
        )
        .bind(nueva_cantidad)
        .bind(nuevo_subtotal)
        .bind(id_item)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    } else {
        // No había línea: insertamos una nueva con el precio y costo vigentes (snapshot o algo asi)
        let row = sqlx::query(
            r#"
            SELECT
            COALESCE(
                (
                SELECT NULLIF(ph.precio, 0)
                FROM precio_historial ph
                WHERE ph.id_producto = ?
                    AND ph.tipo = 'venta'
                    AND ph.vigente_hasta IS NULL
                ORDER BY ph.vigente_desde DESC
                LIMIT 1
                ),
                (SELECT p.precio_venta_actual FROM producto p WHERE p.id_producto = ?)
            ) AS precio_unitario,
            COALESCE(
                (
                SELECT NULLIF(phc.precio, 0)
                FROM precio_historial phc
                WHERE phc.id_producto = ?
                    AND phc.tipo = 'costo'
                    AND phc.vigente_hasta IS NULL
                ORDER BY phc.vigente_desde DESC
                LIMIT 1
                ),
                (SELECT p.costo_actual FROM producto p WHERE p.id_producto = ?)
            ) AS costo_unitario_en_venta
            "#
        )
        .bind(input.id_producto)
        .bind(input.id_producto)
        .bind(input.id_producto)
        .bind(input.id_producto)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        let precio_unitario: i64 = row.get("precio_unitario");
        let costo_unitario_en_venta: i64 = row.get("costo_unitario_en_venta");
        let subtotal = precio_unitario * input.cantidad;

        sqlx::query(
            "INSERT INTO venta_item
                (id_venta, id_producto, cantidad, precio_unitario, costo_unitario_en_venta, fuente_precio, subtotal)
             VALUES(?, ?, ?, ?, ?, 'catalogo', ?)",
        )
        .bind(input.id_venta)
        .bind(input.id_producto)
        .bind(input.cantidad)
        .bind(precio_unitario)
        .bind(costo_unitario_en_venta)
        .bind(subtotal)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    // Recalcular total de la venta
    sqlx::query(
        "UPDATE venta
            SET total = (SELECT COALESCE(SUM(subtotal),0)
                           FROM venta_item
                          WHERE id_venta = ?)
          WHERE id_venta = ?",
    )
    .bind(input.id_venta)
    .bind(input.id_venta)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

// Listar líneas + total
#[tauri::command]
pub async fn venta_listar(
    state: State<'_, AppState>,
    input: VentaListarInput,
) -> Result<(Vec<VentaItemDto>, i64), String> {
    let id_venta = input.id_venta;

    let items = sqlx::query_as::<_, VentaItemDto>(
        r#"
        SELECT
          vi.id_item      AS id_item,
          vi.id_producto  AS id_producto,
          p.nombre        AS nombre,
          vi.cantidad     AS cantidad,
          vi.precio_unitario AS precio_unitario,
          vi.subtotal     AS subtotal
        FROM venta_item vi
        JOIN producto p ON p.id_producto = vi.id_producto
        WHERE vi.id_venta = ?
        ORDER BY vi.id_item
        "#
    )
    .bind(id_venta)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let total: i64 = sqlx::query_scalar(
        "SELECT total FROM venta WHERE id_venta = ?",
    )
    .bind(id_venta)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok((items, total))
}

// Cambiar cantidad (NO toca stock)
#[tauri::command]
pub async fn venta_set_cantidad(
    state: State<'_, AppState>,
    input: SetCantidadInput,
) -> Result<(), String> {
    if input.cantidad <= 0 {
        return Err("Cantidad inválida".into());
    }

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // actualizar cantidad y subtotal
    sqlx::query(
        "UPDATE venta_item
            SET cantidad = ?,
                subtotal = ? * precio_unitario
          WHERE id_item = ?",
    )
    .bind(input.cantidad)
    .bind(input.cantidad)
    .bind(input.id_item)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // sincronizar total de la venta (via id_venta de ese item)
    sqlx::query(
        "UPDATE venta
            SET total = (SELECT COALESCE(SUM(subtotal),0)
                           FROM venta_item
                          WHERE id_venta = (SELECT id_venta FROM venta_item WHERE id_item=?))
          WHERE id_venta = (SELECT id_venta FROM venta_item WHERE id_item=?)",
    )
    .bind(input.id_item)
    .bind(input.id_item)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

// Quitar ítem (NO toca stock)
#[tauri::command]
pub async fn venta_quitar_item(
    state: State<'_, AppState>,
    input: QuitarItemInput,
) -> Result<(), String> {
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    // Guardar id_venta para recalcular total
    let id_venta: Option<i64> = sqlx::query_scalar(
        "SELECT id_venta FROM venta_item WHERE id_item=?",
    )
    .bind(input.id_item)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM venta_item WHERE id_item=?")
        .bind(input.id_item)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(v) = id_venta {
        sqlx::query(
            "UPDATE venta
                SET total = (SELECT COALESCE(SUM(subtotal),0) FROM venta_item WHERE id_venta=?)
              WHERE id_venta=?",
        )
        .bind(v)
        .bind(v)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn venta_cancelar(
    state: State<'_, AppState>,
    input: VentaCancelarInput,
) -> Result<(), String> {
    let id_venta = input.id_venta;

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM venta_item WHERE id_venta=?")
        .bind(id_venta)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE venta SET estado='anulada', total=0 WHERE id_venta=?")
        .bind(id_venta)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn venta_finalizar(
    state: State<'_, AppState>,
    input: VentaFinalizarInput,
) -> Result<(), String> {
    use sqlx::Row;

    let id_venta = input.id_venta;

    if input.pagos.is_empty() {
        return Err("Debe registrar al menos un método de pago".into());
    }

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    let estado: String = sqlx::query_scalar(
        "SELECT estado FROM venta WHERE id_venta = ?",
    )
    .bind(id_venta)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    if estado != "en_curso" {
        return Err("La venta no está en curso o ya fue finalizada".into());
    }

    let items = sqlx::query(
        r#"
        SELECT
          id_producto,
          cantidad,
          costo_unitario_en_venta
        FROM venta_item
        WHERE id_venta = ?
        "#
    )
    .bind(id_venta)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    if items.is_empty() {
        return Err("No se puede finalizar una venta sin items".into());
    }

    let total: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(subtotal), 0) FROM venta_item WHERE id_venta = ?",
    )
    .bind(id_venta)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    if total <= 0 {
        return Err("No se puede finalizar una venta con total 0".into());
    }

    let suma_pagos: i64 = input.pagos.iter().map(|p| p.monto).sum();
    if suma_pagos != total {
        return Err(format!(
            "La suma de los pagos ({}) no coincide con el total de la venta ({})",
            suma_pagos, total
        ));
    }

    sqlx::query(
        r#"
        INSERT INTO stock_mov (
          id_producto,
          cantidad_delta,
          motivo,
          referencia,
          costo_unitario,
          total_costo,
          fecha_hora
        )
        SELECT
          vi.id_producto,
          -vi.cantidad,
          'venta',
          ?,
          vi.costo_unitario_en_venta,
          vi.cantidad * vi.costo_unitario_en_venta,
          DATETIME('now','localtime')
        FROM venta_item vi
        WHERE vi.id_venta = ?
        "#
    )
    .bind(format!("venta:{}", id_venta))
    .bind(id_venta)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM venta_pago WHERE id_venta = ?")
        .bind(id_venta)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    for pago in &input.pagos {
        sqlx::query(
            "INSERT INTO venta_pago (id_venta, medio, monto, referencia)
             VALUES (?, ?, ?, ?)",
        )
        .bind(id_venta)
        .bind(&pago.medio)
        .bind(pago.monto)
        .bind(&pago.referencia)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    sqlx::query(
        "UPDATE venta
         SET estado = 'finalizada', total = ?
         WHERE id_venta = ?",
    )
    .bind(total)
    .bind(id_venta)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}



//Historial de ventas diarias
#[tauri::command]
pub async fn historial_ventas_hoy(
    state: State<'_, AppState>
) -> Result<Vec<HistorialItem>, String> {
    let uid = *state
        .session_user
        .lock()
        .map_err(|_| "lock".to_string())?
        .as_ref()
        .ok_or("No hay sesión")?;

    let items = sqlx::query_as::<_, HistorialItem>(
        r#"
        SELECT
            v.id_venta AS id_venta,
            time(v.fecha_hora, 'localtime') AS hora,
            p.codigo_producto AS codigo_producto,
            p.nombre AS producto,
            vi.cantidad AS cantidad,
            vi.precio_unitario AS precio_unitario,
            vi.subtotal AS subtotal,
            v.total AS total_venta,
            (
                SELECT GROUP_CONCAT(medio || ' $' || monto, ' + ')
                FROM venta_pago
                WHERE id_venta = v.id_venta
            ) AS pagos_detalle
        FROM venta v
        JOIN venta_item vi ON vi.id_venta = v.id_venta
        JOIN producto p ON p.id_producto = vi.id_producto
        WHERE
            v.id_usuario = ?
            AND v.estado = 'finalizada'
            AND v.fecha_hora >= datetime('now','localtime','start of day')
            AND v.fecha_hora <  datetime('now','localtime','start of day','+1 day')
        ORDER BY v.fecha_hora ASC, vi.id_item
        "#
    )
    .bind(uid)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(items)
}


#[tauri::command(rename = "venta_aplicar_promo_combo")]
pub async fn venta_aplicar_promo_combo(
    state: State<'_, AppState>,
    input: PromoComboAplicarInput,
) -> Result<(), String> {
    use sqlx::Row;

    let pool = &state.pool;

    if input.precio_total_pack < 0 {
        return Err("El precio del pack no puede ser negativo.".to_string());
    }

    // 0) Traer combo (incluye precio_pack)
    let combo = sqlx::query(
        r#"
        SELECT id_combo, activo, precio_min_total, precio_pack
        FROM promo_combo
        WHERE id_combo = ?
        "#,
    )
    .bind(input.id_combo)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Combo no encontrado.".to_string())?;

    let activo: i64 = combo.try_get("activo").map_err(|e| e.to_string())?;
    if activo != 1 {
        return Err("El combo está inactivo.".to_string());
    }

    let precio_min_total: i64 = combo.try_get("precio_min_total").map_err(|e| e.to_string())?;
    let precio_pack_db: i64 = combo.try_get("precio_pack").map_err(|e| e.to_string())?;

    //  Determinar precio a aplicar (input > 0, si no DB)
    let precio_pack_aplicar = if input.precio_total_pack > 0 {
        input.precio_total_pack
    } else {
        precio_pack_db
    };

    if precio_pack_aplicar <= 0 {
        return Err("El precio del pack no está definido (0). Definilo al crear el combo o ingresalo manualmente.".to_string());
    }
    if precio_pack_aplicar < precio_min_total {
        return Err(format!(
            "El precio del pack (${precio_pack_aplicar}) no puede ser menor al mínimo (${precio_min_total})."
        ));
    }

    //  Items del combo
    let items = sqlx::query(
        r#"
        SELECT id_producto, cantidad
        FROM promo_combo_item
        WHERE id_combo = ?
        "#,
    )
    .bind(input.id_combo)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    if items.is_empty() {
        return Err("El combo no tiene productos.".to_string());
    }

    //  Traer precio/costo actual por producto y preparar prorrateo
    #[derive(Clone)]
    struct ItemCalc {
        id_producto: i64,
        cant: i64,
        costo_unit: i64,
        base_total: i64,   // precio_catalogo * cant (solo para ponderar)
        asign_total: i64,  // total asignado exacto para este producto dentro del pack
        resto: i64,
    }

    let mut calc: Vec<ItemCalc> = Vec::with_capacity(items.len());
    for r in items {
        let id_producto: i64 = r.try_get("id_producto").map_err(|e| e.to_string())?;
        let cant: i64 = r.try_get("cantidad").map_err(|e| e.to_string())?;

        let prod = sqlx::query(
            r#"
            SELECT precio_venta_actual, costo_actual
            FROM producto
            WHERE id_producto = ? AND activo = 1
            "#,
        )
        .bind(id_producto)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Producto {id_producto} no existe o está inactivo."))?;

        let precio_catalogo: i64 = prod.try_get("precio_venta_actual").map_err(|e| e.to_string())?;
        let costo_unit: i64 = prod.try_get("costo_actual").map_err(|e| e.to_string())?;

        let base_total = precio_catalogo
            .checked_mul(cant)
            .ok_or_else(|| "Overflow calculando total base.".to_string())?;

        calc.push(ItemCalc {
            id_producto,
            cant,
            costo_unit,
            base_total,
            asign_total: 0,
            resto: 0,
        });
    }

    let base_sum: i64 = calc.iter().map(|x| x.base_total).sum();
    if base_sum <= 0 {
        return Err("No se puede prorratear: suma base (catálogo) es 0.".to_string());
    }

    //  Prorrateo exacto por "resto mayor"
    let mut asign_sum: i64 = 0;
    for it in calc.iter_mut() {
        let num = it
            .base_total
            .checked_mul(precio_pack_aplicar)
            .ok_or_else(|| "Overflow en prorrateo.".to_string())?;

        it.asign_total = num / base_sum;
        it.resto = num % base_sum;
        asign_sum += it.asign_total;
    }

    let mut faltante = precio_pack_aplicar - asign_sum;
    if faltante > 0 {
        calc.sort_by(|a, b| b.resto.cmp(&a.resto));
        for it in calc.iter_mut() {
            if faltante == 0 {
                break;
            }
            it.asign_total += 1;
            faltante -= 1;
        }
    }

    //  Insertar líneas promo SIN pisar lo existente (transacción)
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    for it in calc {
        // Queremos: subtotal == cantidad * precio_unitario SIEMPRE.
        // Repartimos el total asignado en (base) y (base+1) si hay resto por unidad.
        let base_unit = it.asign_total / it.cant;
        let rem_units = it.asign_total % it.cant; // cantidad que debe ir a (base+1)

        let cant_base = it.cant - rem_units;
        if cant_base > 0 {
            let subtotal_base = cant_base
                .checked_mul(base_unit)
                .ok_or_else(|| "Overflow subtotal_base.".to_string())?;

            sqlx::query(
                r#"
                INSERT INTO venta_item (
                    id_venta, id_producto, cantidad,
                    precio_unitario, costo_unitario_en_venta,
                    fuente_precio, subtotal
                ) VALUES (?, ?, ?, ?, ?, 'promo', ?)
                "#,
            )
            .bind(input.id_venta)
            .bind(it.id_producto)
            .bind(cant_base)
            .bind(base_unit)
            .bind(it.costo_unit)
            .bind(subtotal_base)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }

        if rem_units > 0 {
            let unit_plus = base_unit + 1;
            let subtotal_plus = rem_units
                .checked_mul(unit_plus)
                .ok_or_else(|| "Overflow subtotal_plus.".to_string())?;

            sqlx::query(
                r#"
                INSERT INTO venta_item (
                    id_venta, id_producto, cantidad,
                    precio_unitario, costo_unitario_en_venta,
                    fuente_precio, subtotal
                ) VALUES (?, ?, ?, ?, ?, 'promo', ?)
                "#,
            )
            .bind(input.id_venta)
            .bind(it.id_producto)
            .bind(rem_units)
            .bind(unit_plus)
            .bind(it.costo_unit)
            .bind(subtotal_plus)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}