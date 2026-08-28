use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use async_trait::async_trait;
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::{Method, StatusCode};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::OnceLock;

use crate::AppState;

pub const SESSION_COOKIE: &str = "hearth_session";
const SESSION_TTL_SECS: i64 = 60 * 60 * 24 * 7;

fn jwt_secret() -> &'static str {
    static SECRET: OnceLock<String> = OnceLock::new();
    SECRET.get_or_init(|| match std::env::var("HEARTH_JWT_SECRET") {
        Ok(secret) => secret,
        Err(_) => {
            tracing::warn!(
                "HEARTH_JWT_SECRET is not set — falling back to a hardcoded dev secret. \
                 Set a real random value before deploying anywhere but localhost."
            );
            "dev-only-insecure-secret-change-me".to_string()
        }
    })
}

/// Generates a new personal access token. Returns `(raw_token, sha256_hash)` —
/// only the hash should ever be persisted; the raw value is shown to the user once.
pub fn generate_pat() -> (String, String) {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let raw = format!("hearth_pat_{}", hex::encode(bytes));
    let hash = hash_token(&raw);
    (raw, hash)
}

pub fn hash_token(raw: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    hex::encode(hasher.finalize())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub system_role: String,
    pub exp: i64,
}

pub fn hash_password(password: &str) -> anyhow::Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow::anyhow!("hashing failed: {e}"))?;
    Ok(hash.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

/// Issues a session cookie. When `remember` is false, the cookie carries no
/// `Max-Age` and is dropped by the browser when it closes (still valid for the
/// full TTL server-side in the meantime, since that's encoded in the JWT itself).
pub fn issue_session_cookie(user_id: &str, email: &str, system_role: &str, remember: bool) -> Cookie<'static> {
    let exp = chrono::Utc::now().timestamp() + SESSION_TTL_SECS;
    let claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        system_role: system_role.to_string(),
        exp,
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret().as_bytes()),
    )
    .expect("jwt encode");

    let mut builder = Cookie::build((SESSION_COOKIE, token))
        .path("/")
        .http_only(true)
        .same_site(cookie::SameSite::Lax);
    if remember {
        builder = builder.max_age(cookie::time::Duration::seconds(SESSION_TTL_SECS));
    }
    builder.build()
}

pub fn clear_session_cookie() -> Cookie<'static> {
    Cookie::build((SESSION_COOKIE, ""))
        .path("/")
        .http_only(true)
        .max_age(cookie::time::Duration::ZERO)
        .build()
}

/// Extractor that requires either a valid session cookie or a `Bearer` personal
/// access token; use in handlers as `current_user: CurrentUser`.
pub struct CurrentUser {
    pub id: String,
    pub email: String,
    pub system_role: String,
}

#[async_trait]
impl FromRequestParts<AppState> for CurrentUser {
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        // CookieJar's extraction is infallible (it just reads headers).
        let jar = CookieJar::from_request_parts(parts, state).await.unwrap();
        if let Some(cookie) = jar.get(SESSION_COOKIE) {
            if let Ok(data) = decode::<Claims>(
                cookie.value(),
                &DecodingKey::from_secret(jwt_secret().as_bytes()),
                &Validation::default(),
            ) {
                return Ok(CurrentUser {
                    id: data.claims.sub,
                    email: data.claims.email,
                    system_role: data.claims.system_role,
                });
            }
        }

        if let Some(raw_token) = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
        {
            let hash = hash_token(raw_token);
            let row: Option<(String, String, String, String, Option<chrono::DateTime<chrono::Utc>>)> = sqlx::query_as(
                "SELECT u.id, u.email, u.system_role, at.permission, at.expires_at
                 FROM access_tokens at JOIN users u ON u.id = at.user_id
                 WHERE at.token_hash = ?",
            )
            .bind(&hash)
            .fetch_optional(&state.db)
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "database error"))?;

            if let Some((id, email, system_role, permission, expires_at)) = row {
                if let Some(exp) = expires_at {
                    if exp < chrono::Utc::now() {
                        return Err((StatusCode::UNAUTHORIZED, "token expired"));
                    }
                }
                if permission == "read" && parts.method != Method::GET && parts.method != Method::HEAD {
                    return Err((StatusCode::FORBIDDEN, "this token is read-only"));
                }
                let _ = sqlx::query(
                    "UPDATE access_tokens SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE token_hash = ?",
                )
                .bind(&hash)
                .execute(&state.db)
                .await;
                let current_user = CurrentUser { id, email, system_role };
                tracing::debug!(user_id = %current_user.id, email = %current_user.email, "authenticated via personal access token");
                return Ok(current_user);
            }
        }

        Err((StatusCode::UNAUTHORIZED, "not authenticated"))
    }
}
