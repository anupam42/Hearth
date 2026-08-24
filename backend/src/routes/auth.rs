use axum::extract::State;
use axum::response::IntoResponse;
use axum::Json;
use axum_extra::extract::cookie::CookieJar;
use uuid::Uuid;

use crate::auth::{self, CurrentUser};
use crate::error::{AppError, AppResult};
use crate::models::{LoginRequest, RegisterRequest, User};
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

    let cookie = auth::issue_session_cookie(&id, &req.email, "user");
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

    let cookie = auth::issue_session_cookie(&user.id, &user.email, &user.system_role);
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
