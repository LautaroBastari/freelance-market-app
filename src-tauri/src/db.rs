use std::{env, fs, str::FromStr, time::Duration};

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqliteSynchronous};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use tauri::path::BaseDirectory;
use tauri::Manager;

use sqlx::Executor;

pub fn resolve_db_url(app: &tauri::AppHandle) -> anyhow::Result<String> {
    if cfg!(debug_assertions) {
        if let Ok(url) = env::var("DATABASE_URL") {
            return Ok(url);
        }
    }

    // AppData/<identifier>/data/data.db
    let data_dir = app
        .path()
        .resolve("data", BaseDirectory::AppData)
        .map_err(|e| anyhow::anyhow!("No se pudo resolver AppData/data: {e}"))?;

    fs::create_dir_all(&data_dir)?;
    let db_path = data_dir.join("data.db");

    Ok(format!("sqlite:{}", db_path.to_string_lossy()))
}

// Inicializa pool y corre migraciones
pub async fn init_db_with_url(db_url: &str) -> anyhow::Result<SqlitePool> {
    let connect_opts = SqliteConnectOptions::from_str(db_url)?
        .create_if_missing(true)                 
        .foreign_keys(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(Duration::from_millis(3000));

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .after_connect(|conn, _meta| {
            Box::pin(async move {
                conn.execute("PRAGMA foreign_keys = ON;").await?;
                conn.execute("PRAGMA temp_store = MEMORY;").await?;
                conn.execute("PRAGMA cache_size = -20000;").await?;
                conn.execute("PRAGMA mmap_size = 268435456;").await?;
                Ok(())
            })
        })
        .connect_with(connect_opts)
        .await?;

    // Corre todas las migraciones
    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}

pub async fn init_db(app: &tauri::AppHandle) -> anyhow::Result<SqlitePool> {
    let url = resolve_db_url(app)?;
    init_db_with_url(&url).await
}

pub async fn optimize_sqlite(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query("PRAGMA optimize;").execute(pool).await?;
    Ok(())
}
