use axum::extract::State;
use axum::Json;
use serde_json::json;

use crate::auth::CurrentUser;
use crate::error::{AppError, AppResult};
use crate::models::AuditEntryView;
use crate::AppState;

pub async fn list(current_user: CurrentUser, State(state): State<AppState>) -> AppResult<Json<Vec<AuditEntryView>>> {
    if current_user.system_role != "admin" {
        return Err(AppError::Forbidden);
    }
    let entries: Vec<AuditEntryView> = sqlx::query_as(
        "SELECT a.id, a.actor_id, u.display_name as actor_name, u.email as actor_email,
                a.action, a.entity_type, a.entity_id, a.details, a.prev_hash, a.hash, a.created_at
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.actor_id
         ORDER BY a.created_at DESC LIMIT 500",
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
