use std::sync::RwLock;

#[derive(Default)]
pub struct AuthState {
    pub current_user_id: RwLock<Option<i64>>,
}

