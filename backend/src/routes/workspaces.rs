use axum::extract::State;
use axum::Json;
use uuid::Uuid;

use crate::auth::CurrentUser;
use crate::error::{AppError, AppResult};
use crate::models::{CreateWorkspaceRequest, Workspace};
use crate::AppState;

fn require_admin(current_user: &CurrentUser) -> AppResult<()> {
    if current_user.system_role != "admin" {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

pub async fn list(current_user: CurrentUser, State(state): State<AppState>) -> AppResult<Json<Vec<Workspace>>> {
    require_admin(&current_user)?;
    let workspaces: Vec<Workspace> = sqlx::query_as(
        "SELECT id, key, name, description, created_by, created_at FROM workspaces ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(workspaces))
}

pub async fn create(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Json(req): Json<CreateWorkspaceRequest>,
) -> AppResult<Json<Workspace>> {
    require_admin(&current_user)?;

    if req.key.is_empty() || !req.key.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(AppError::BadRequest(
            "workspace key must be alphanumeric".into(),
        ));
    }
    let key = req.key.to_uppercase();
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO workspaces (id, key, name, description, created_by) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&key)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&current_user.id)
    .execute(&state.db)
    .await?;

    crate::audit::append(
        &state.db,
        &current_user.id,
        "workspace.create",
        "workspace",
        &id,
        &serde_json::json!({ "key": key, "name": req.name }).to_string(),
    )
    .await?;

    let workspace: Workspace = sqlx::query_as(
        "SELECT id, key, name, description, created_by, created_at FROM workspaces WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(workspace))
}
