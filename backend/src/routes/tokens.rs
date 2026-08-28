use axum::extract::{Path, State};
use axum::Json;
use uuid::Uuid;

use crate::auth::{self, CurrentUser};
use crate::error::{AppError, AppResult};
use crate::models::{AccessToken, CreateAccessTokenRequest, CreateAccessTokenResponse};
use crate::AppState;

const VALID_PERMISSIONS: &[&str] = &["read", "read_write"];

pub async fn list(current_user: CurrentUser, State(state): State<AppState>) -> AppResult<Json<Vec<AccessToken>>> {
    let tokens: Vec<AccessToken> = sqlx::query_as(
        "SELECT id, name, permission, expires_at, created_at, last_used_at
         FROM access_tokens WHERE user_id = ? ORDER BY created_at DESC",
    )
    .bind(&current_user.id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(tokens))
}

pub async fn create(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Json(req): Json<CreateAccessTokenRequest>,
) -> AppResult<Json<CreateAccessTokenResponse>> {
    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("token name is required".into()));
    }
    let permission = req.permission.unwrap_or_else(|| "read_write".to_string());
    if !VALID_PERMISSIONS.contains(&permission.as_str()) {
        return Err(AppError::BadRequest("permission must be 'read' or 'read_write'".into()));
    }

    let id = Uuid::new_v4().to_string();
    let (raw_token, hash) = auth::generate_pat();

    sqlx::query(
        "INSERT INTO access_tokens (id, user_id, name, token_hash, permission, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&current_user.id)
    .bind(&req.name)
    .bind(&hash)
    .bind(&permission)
    .bind(req.expires_at)
    .execute(&state.db)
    .await?;

    crate::audit::append(
        &state.db,
        &current_user.id,
        "token.create",
        "access_token",
        &id,
        &serde_json::json!({ "name": req.name, "permission": permission }).to_string(),
    )
    .await?;

    let token: AccessToken = sqlx::query_as(
        "SELECT id, name, permission, expires_at, created_at, last_used_at FROM access_tokens WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(CreateAccessTokenResponse { token, secret: raw_token }))
}

pub async fn delete(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Path(token_id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query("DELETE FROM access_tokens WHERE id = ? AND user_id = ?")
        .bind(&token_id)
        .bind(&current_user.id)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    crate::audit::append(
        &state.db,
        &current_user.id,
        "token.revoke",
        "access_token",
        &token_id,
        "{}",
    )
    .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}
