use anyhow::{anyhow, Result};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::SaltString;
use rand_core::OsRng; // requiere features=["getrandom"] en Cargo.toml

pub fn hash_password(plain: &str) -> Result<String> {
    if plain.is_empty() {
        return Err(anyhow!("Password vacío"));
    }
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(plain.as_bytes(), &salt)
        .map_err(|e| anyhow!(e))?
        .to_string();
    Ok(hash)
}

pub fn verify_password(plain: &str, hash_str: &str) -> Result<bool> {
    let parsed = PasswordHash::new(hash_str).map_err(|e| anyhow!(e))?;
    Ok(Argon2::default().verify_password(plain.as_bytes(), &parsed).is_ok())
}
