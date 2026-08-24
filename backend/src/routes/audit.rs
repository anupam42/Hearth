use axum::extract::State;
use axum::Json;
use serde_json::json;

use crate::auth::CurrentUser;
use crate::error::{AppError, AppResult};
use crate::AppState;

pub async fn list(current_user: CurrentUser, State(state): State<AppState>) -> AppResult<Json<Vec<crate::audit::AuditEntry>>> {
    if current_user.system_role != "admin" {
        return Err(AppError::Forbidden);
    }
    let entries: Vec<crate::audit::AuditEntry> = sqlx::query_as(
        "SELECT id, actor_id, action, entity_type, entity_id, details, prev_hash, hash, created_at
         FROM audit_log ORDER BY created_at DESC LIMIT 500",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(entries))
}

pub async fn verify(current_user: CurrentUser, State(state): State<AppState>) -> AppResult<Json<serde_json::Value>> {
    if current_user.system_role != "admin" {
        return Err(AppError::Forbidden);
    }
    match crate::audit::verify_chain(&state.db).await {
        Ok(()) => Ok(Json(json!({ "intact": true }))),
        Err(e) => Ok(Json(json!({ "intact": false, "error": e.to_string() }))),
    }
}
