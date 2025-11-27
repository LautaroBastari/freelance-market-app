use std::{env, fs, str::FromStr, time::Duration};
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqliteSynchronous};
use sqlx::{migrate::MigrateDatabase, sqlite::SqlitePoolOptions, Sqlite, SqlitePool};
use tauri::path::BaseDirectory;
use tauri::Manager;
use sqlx::Executor;


pub fn resolve_db_url(app: &tauri::AppHandle) -> String {
    if let Ok(url) = env::var("DATABASE_URL") {
        return url;
    }

    // Carpeta de datos de la app (Tauri 2)
    let data_dir = app
        .path()
        .resolve("data", BaseDirectory::AppData)
        .expect("No se pudo resolver AppData/data");

    fs::create_dir_all(&data_dir).expect("No se pudo crear AppData/data");
    let db_path = data_dir.join("data.db");

    format!("sqlite:{}", db_path.to_string_lossy())
}

/// Inicializa la BD usando una URL ya resuelta.
/// - Crea la BD si no existe
/// - Activa FK, WAL, etc. en **cada** conexión del pool
/// - Corre migraciones desde `./migrations` (relativo al Cargo.toml de `src-tauri`)
pub async fn init_db_with_url(db_url: &str) -> anyhow::Result<SqlitePool> {
    // Crear BD si no existe (idempotente)
    if !Sqlite::database_exists(db_url).await.unwrap_or(false) {
        Sqlite::create_database(db_url).await?;
    }

    // Opciones por conexión (se aplican a todas las conexiones del pool)
    let connect_opts = SqliteConnectOptions::from_str(db_url)?
        .create_if_missing(true)
        .foreign_keys(true)                      // PRAGMA foreign_keys = ON
        .journal_mode(SqliteJournalMode::Wal)    // PRAGMA journal_mode = WAL
        .synchronous(SqliteSynchronous::Normal)  // PRAGMA synchronous = NORMAL
        .busy_timeout(Duration::from_millis(3000));

    // Pool + hook para garantizar PRAGMA por-conexión
    let pool = SqlitePoolOptions::new()
    .max_connections(5)
    .after_connect(|conn, _meta| {
        Box::pin(async move {
            // PRAGMA por conexión (sin mover `conn`)
            conn.execute("PRAGMA foreign_keys = ON;").await?;
            conn.execute("PRAGMA temp_store = MEMORY;").await?;
            conn.execute("PRAGMA cache_size = -20000;").await?;     // ~20 MB
            conn.execute("PRAGMA mmap_size = 268435456;").await?;   // 256 MB
            Ok(())
        })
    })
    .connect_with(connect_opts)
    .await?;

    // Migraciones: ruta relativa al Cargo.toml del crate `src-tauri`
    // (Asegurate de que tus archivos estén en `src-tauri/migrations`)
    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}

/// Conveniencia: resuelve la URL según Tauri 2 y llama a `init_db_with_url`.
pub async fn init_db(app: &tauri::AppHandle) -> anyhow::Result<SqlitePool> {
    let url = resolve_db_url(app);
    init_db_with_url(&url).await
}

/// Mantenimiento opcional (ejecutalo cada tanto)
pub async fn optimize_sqlite(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query("PRAGMA optimize;").execute(pool).await?;
    Ok(())
}
