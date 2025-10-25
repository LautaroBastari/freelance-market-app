use sqlx::{SqlitePool, Row, sqlite::SqliteQueryResult};
use time::OffsetDateTime;

#[derive(Copy, Clone, Debug)]
pub enum TipoPrecio { Venta, Costo }

impl TipoPrecio {
    pub fn as_str(&self) -> &'static str {
        match self {
            TipoPrecio::Venta => "venta",
            TipoPrecio::Costo => "costo",
        }
    }
}

/* ===== Crear producto ===== */
pub async fn producto_crear(
    pool: &SqlitePool,
    codigo: &str,
    nombre: &str,
    precio_venta: i64,
    costo: i64,
) -> anyhow::Result<i64> {
    if precio_venta < 0 || costo < 0 { anyhow::bail!("precio/costo negativos"); }

    let mut tx = pool.begin().await?;

    // Inserta producto (precio_*_actual iniciales)
    let res: SqliteQueryResult = sqlx::query(
        "INSERT INTO producto(codigo_producto,nombre,precio_venta_actual,costo_actual,activo)
         VALUES (?1,?2,?3,?4,1)"
    )
    .bind(codigo)
    .bind(nombre)
    .bind(precio_venta)
    .bind(costo)
    .execute(&mut *tx)
    .await?;

    let id = res.last_insert_rowid();

    // Cargar historial inicial (triggers sincronizan vigente_hasta y actuales)
    sqlx::query(
        "INSERT INTO precio_historial(id_producto,tipo,precio,vigente_desde,vigente_hasta)
         VALUES (?1,'venta',?2, CURRENT_TIMESTAMP, NULL)"
    )
    .bind(id)
    .bind(precio_venta)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO precio_historial(id_producto,tipo,precio,vigente_desde,vigente_hasta)
         VALUES (?1,'costo',?2, CURRENT_TIMESTAMP, NULL)"
    )
    .bind(id)
    .bind(costo)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(id)
}

/* ===== Actualizar básicos ===== */
pub async fn producto_actualizar(
    pool: &SqlitePool,
    id_producto: i64,
    codigo: Option<&str>,
    nombre: Option<&str>,
    activo: Option<i64>,
) -> anyhow::Result<()> {
    // build dinámico simple
    let mut sets = Vec::<(&str, String)>::new();
    if let Some(c) = codigo { sets.push(("codigo_producto", c.to_string())); }
    if let Some(n) = nombre { sets.push(("nombre", n.to_string())); }
    if let Some(a) = activo { sets.push(("activo", a.to_string())); }

    if sets.is_empty() { return Ok(()); }

    let mut sql = String::from("UPDATE producto SET ");
    for (i, (col, _)) in sets.iter().enumerate() {
        if i > 0 { sql.push_str(", "); }
        sql.push_str(col); sql.push_str(" = ?"); sql.push_str(&(i+1).to_string());
    }
    sql.push_str(" WHERE id_producto = ?"); sql.push_str(&(sets.len()+1).to_string());

    let mut q = sqlx::query(&sql);
    for (_, v) in &sets { q = q.bind(v); }
    q = q.bind(id_producto);
    q.execute(pool).await?;
    Ok(())
}

pub async fn producto_set_activo(pool: &SqlitePool, id_producto: i64, activo: bool) -> anyhow::Result<()> {
    sqlx::query("UPDATE producto SET activo=?1 WHERE id_producto=?2")
        .bind(if activo {1} else {0})
        .bind(id_producto)
        .execute(pool).await?;
    Ok(())
}

/* ===== Ajuste de stock (delta) ===== */
pub async fn stock_ajustar(
    pool: &SqlitePool,
    id_producto: i64,
    delta: i64,
    motivo: &str,
    referencia: Option<&str>,
) -> anyhow::Result<i64> {
    if delta == 0 { anyhow::bail!("delta = 0 no tiene efecto"); }
    if motivo.trim().is_empty() { anyhow::bail!("motivo requerido"); }

    let mut tx = pool.begin().await?;

    let res = sqlx::query(
        "INSERT INTO stock_mov(id_producto,cantidad_delta,motivo,referencia,fecha_hora)
         VALUES (?1,?2,?3,?4,CURRENT_TIMESTAMP)"
    )
    .bind(id_producto)
    .bind(delta)
    .bind(motivo)
    .bind(referencia.unwrap_or(""))
    .execute(&mut *tx)
    .await;

    // Propaga errores de trigger con mensaje limpio
    match res {
        Ok(r) => {
            let id = r.last_insert_rowid();
            tx.commit().await?;
            Ok(id)
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("Stock negativo no permitido") {
                anyhow::bail!("stock negativo no permitido");
            }
            anyhow::bail!(msg);
        }
    }
}

/* ===== Actualizar precio (historial) ===== */
pub async fn precio_actualizar(
    pool: &SqlitePool,
    id_producto: i64,
    tipo: TipoPrecio,
    nuevo: i64,
) -> anyhow::Result<i64> {
    if nuevo < 0 { anyhow::bail!("precio negativo"); }

    let res = sqlx::query(
        "INSERT INTO precio_historial(id_producto,tipo,precio,vigente_desde,vigente_hasta)
         VALUES (?1,?2,?3,CURRENT_TIMESTAMP,NULL)"
    )
    .bind(id_producto)
    .bind(tipo.as_str())
    .bind(nuevo)
    .execute(pool)
    .await?;

    Ok(res.last_insert_rowid())
}

/* ===== Historias ===== */
pub struct StockMovRow {
    pub id_movimiento: i64,
    pub cantidad_delta: i64,
    pub motivo: String,
    pub referencia: Option<String>,
    pub fecha_hora: String,
}

pub async fn stock_mov_listar(
    pool: &SqlitePool,
    id_producto: i64,
    limit: i64,
) -> anyhow::Result<Vec<StockMovRow>> {
    let rows = sqlx::query(
        "SELECT id_movimiento,cantidad_delta,motivo,referencia,fecha_hora
         FROM stock_mov WHERE id_producto=?1
         ORDER BY fecha_hora DESC
         LIMIT ?2"
    )
    .bind(id_producto)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|r| StockMovRow {
        id_movimiento: r.get(0),
        cantidad_delta: r.get(1),
        motivo: r.get::<String, _>(2),
        referencia: r.get::<Option<String>, _>(3),
        fecha_hora: r.get::<String, _>(4),
    }).collect())
}

pub struct PrecioHistRow {
    pub id_precio: i64,
    pub tipo: String,
    pub precio: i64,
    pub vigente_desde: String,
    pub vigente_hasta: Option<String>,
}

pub async fn precio_hist_listar(
    pool: &SqlitePool,
    id_producto: i64,
    tipo: Option<&str>,
    limit: i64,
) -> anyhow::Result<Vec<PrecioHistRow>> {
    let (sql, bind_tipo) = if tipo.is_some() {
        (
            "SELECT id_precio,tipo,precio,vigente_desde,vigente_hasta
             FROM precio_historial
             WHERE id_producto=?1 AND tipo=?2
             ORDER BY vigente_desde DESC
             LIMIT ?3",
            true
        )
    } else {
        (
            "SELECT id_precio,tipo,precio,vigente_desde,vigente_hasta
             FROM precio_historial
             WHERE id_producto=?1
             ORDER BY vigente_desde DESC
             LIMIT ?2",
            false
        )
    };

    let mut q = sqlx::query(sql).bind(id_producto);
    if bind_tipo { q = q.bind(tipo.unwrap()); }
    q = q.bind(limit);

    let rows = q.fetch_all(pool).await?;
    Ok(rows.into_iter().map(|r| PrecioHistRow {
        id_precio: r.get(0),
        tipo: r.get::<String,_>(1),
        precio: r.get(2),
        vigente_desde: r.get::<String,_>(3),
        vigente_hasta: r.get::<Option<String>,_>(4),
    }).collect())
}
