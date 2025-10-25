use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqliteSynchronous};
use sqlx::{SqlitePool, migrate::MigrateDatabase};
use std::str::FromStr;

pub async fn init_db(db_url: &str) -> anyhow::Result<SqlitePool> {
    // crea la BD si no existe
    if !sqlx::Sqlite::database_exists(db_url).await.unwrap_or(false) {
        sqlx::Sqlite::create_database(db_url).await?;
    }

    // opciones base (estas ya activan foreign_keys, WAL y synchronous)
    let opts = SqliteConnectOptions::from_str(db_url)?
        .create_if_missing(true)
        .foreign_keys(true)                         // PRAGMA foreign_keys=ON
        .journal_mode(SqliteJournalMode::Wal)       // PRAGMA journal_mode=WAL
        .synchronous(SqliteSynchronous::Normal)     // PRAGMA synchronous=NORMAL
        .busy_timeout(std::time::Duration::from_millis(3000));

    let pool = SqlitePool::connect_with(opts).await?;

    // PRAGMAs adicionales de rendimiento
    for pragma in [
        "PRAGMA temp_store=MEMORY;",     // temporales en RAM
        "PRAGMA cache_size=-20000;",     // ~20 MB de caché en RAM
        "PRAGMA mmap_size=268435456;",   // 256 MB mapeados (si la máquina lo aguanta)
    ] {
        sqlx::query(pragma).execute(&pool).await?;
    }

    // correr migraciones
    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}

// Función de mantenimiento: ejecutar de vez en cuando
pub async fn optimize_sqlite(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query("PRAGMA optimize;").execute(pool).await?;
    Ok(())
}
