use sqlx::SqlitePool;
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub pool: SqlitePool,
    pub session_user: Arc<Mutex<Option<i64>>>,
}
