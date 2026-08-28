use axum::extract::State;
use axum::response::IntoResponse;
use axum::Json;
use axum_extra::extract::cookie::CookieJar;
use uuid::Uuid;

use crate::auth::{self, CurrentUser};
use crate::error::{AppError, AppResult};
use crate::models::{LoginRequest, RegisterRequest, UpdateProfileRequest, User};
use crate::AppState;

pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> AppResult<impl IntoResponse> {
    if req.password.len() < 8 {
        return Err(AppError::BadRequest(
            "password must be at least 8 characters".into(),
        ));
    }

    let existing: Option<(String,)> = sqlx::query_as("SELECT id FROM users WHERE email = ?")
        .bind(&req.email)
        .fetch_optional(&state.db)
        .await?;
    if existing.is_some() {
        return Err(AppError::BadRequest("email already registered".into()));
    }

    let id = Uuid::new_v4().to_string();
    let password_hash = auth::hash_password(&req.password)
        .map_err(AppError::Internal)?;

    sqlx::query(
        "INSERT INTO users (id, email, display_name, system_role, password_hash) VALUES (?, ?, ?, 'user', ?)",
    )
    .bind(&id)
    .bind(&req.email)
    .bind(&req.display_name)
    .bind(&password_hash)
    .execute(&state.db)
    .await?;

    crate::audit::append(&state.db, &id, "user.register", "user", &id, "{}").await?;

    let cookie = auth::issue_session_cookie(&id, &req.email, "user", true);
    let jar = CookieJar::new().add(cookie);
    Ok((jar, Json(serde_json::json!({ "id": id, "email": req.email }))))
}

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> AppResult<impl IntoResponse> {
    let user: Option<User> = sqlx::query_as(
        "SELECT id, email, display_name, system_role, password_hash, created_at FROM users WHERE email = ?",
    )
    .bind(&req.email)
    .fetch_optional(&state.db)
    .await?;

    let Some(user) = user else {
        return Err(AppError::Unauthorized);
    };
    let Some(hash) = &user.password_hash else {
        return Err(AppError::Unauthorized);
    };
    if !auth::verify_password(&req.password, hash) {
        return Err(AppError::Unauthorized);
    }

    crate::audit::append(&state.db, &user.id, "user.login", "user", &user.id, "{}").await?;

    let cookie = auth::issue_session_cookie(&user.id, &user.email, &user.system_role, req.remember.unwrap_or(true));
    let jar = CookieJar::new().add(cookie);
    Ok((jar, Json(user)))
}

pub async fn logout() -> impl IntoResponse {
    let jar = CookieJar::new().add(auth::clear_session_cookie());
    (jar, Json(serde_json::json!({ "ok": true })))
}

pub async fn me(current_user: CurrentUser, State(state): State<AppState>) -> AppResult<impl IntoResponse> {
    let user: User = sqlx::query_as(
        "SELECT id, email, display_name, system_role, password_hash, created_at FROM users WHERE id = ?",
    )
    .bind(&current_user.id)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(user))
}

pub async fn update_profile(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Json(req): Json<UpdateProfileRequest>,
) -> AppResult<impl IntoResponse> {
    let existing: User = sqlx::query_as(
        "SELECT id, email, display_name, system_role, password_hash, created_at FROM users WHERE id = ?",
    )
    .bind(&current_user.id)
    .fetch_one(&state.db)
    .await?;

    let display_name = req.display_name.unwrap_or(existing.display_name);
    let previous_email = existing.email.clone();
    let email = req.email.unwrap_or(existing.email);

    let password_hash = if let Some(new_password) = req.new_password {
        if new_password.len() < 8 {
            return Err(AppError::BadRequest("password must be at least 8 characters".into()));
        }
        let current_password = req
            .current_password
            .ok_or_else(|| AppError::BadRequest("current_password is required to set a new password".into()))?;
        let Some(hash) = &existing.password_hash else {
            return Err(AppError::BadRequest("this account has no password to verify against".into()));
        };
        if !auth::verify_password(&current_password, hash) {
            return Err(AppError::Unauthorized);
        }
        Some(auth::hash_password(&new_password).map_err(AppError::Internal)?)
    } else {
        None
    };

    if email != previous_email {
        let taken: Option<(String,)> = sqlx::query_as("SELECT id FROM users WHERE email = ? AND id != ?")
            .bind(&email)
            .bind(&current_user.id)
            .fetch_optional(&state.db)
            .await?;
        if taken.is_some() {
            return Err(AppError::BadRequest("email already in use".into()));
        }
    }

    sqlx::query(
        "UPDATE users SET display_name = ?, email = ?, password_hash = COALESCE(?, password_hash) WHERE id = ?",
    )
    .bind(&display_name)
    .bind(&email)
    .bind(&password_hash)
    .bind(&current_user.id)
    .execute(&state.db)
    .await?;

    crate::audit::append(
        &state.db,
        &current_user.id,
        "user.update_profile",
        "user",
        &current_user.id,
        &serde_json::json!({ "password_changed": password_hash.is_some() }).to_string(),
    )
    .await?;

    let updated: User = sqlx::query_as(
        "SELECT id, email, display_name, system_role, password_hash, created_at FROM users WHERE id = ?",
    )
    .bind(&current_user.id)
    .fetch_one(&state.db)
    .await?;

    // Claims embed email/role, so refresh the cookie whenever either could have changed.
    let cookie = auth::issue_session_cookie(&updated.id, &updated.email, &updated.system_role, true);
    let jar = CookieJar::new().add(cookie);
    Ok((jar, Json(updated)))
}
