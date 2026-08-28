use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::CurrentUser;
use crate::error::{AppError, AppResult};
use crate::models::{CreateProjectRequest, Project};
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct ListProjectsQuery {
    pub workspace_id: Option<String>,
}

pub async fn list(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Query(query): Query<ListProjectsQuery>,
) -> AppResult<Json<Vec<Project>>> {
    let projects: Vec<Project> = sqlx::query_as(
        "SELECT p.id, p.key, p.name, p.description, p.workspace_id, p.created_by, p.created_at
         FROM projects p
         JOIN project_members pm ON pm.project_id = p.id
         WHERE pm.user_id = ? AND (? IS NULL OR p.workspace_id = ?)
         ORDER BY p.created_at DESC",
    )
    .bind(&current_user.id)
    .bind(&query.workspace_id)
    .bind(&query.workspace_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(projects))
}

pub async fn create(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Json(req): Json<CreateProjectRequest>,
) -> AppResult<Json<Project>> {
    if req.key.is_empty() || !req.key.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(AppError::BadRequest(
            "project key must be alphanumeric".into(),
        ));
    }
    let key = req.key.to_uppercase();

    let id = Uuid::new_v4().to_string();
    let mut tx = state.db.begin().await?;

    sqlx::query(
        "INSERT INTO projects (id, key, name, description, workspace_id, created_by) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&key)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.workspace_id)
    .bind(&current_user.id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'admin')",
    )
    .bind(&id)
    .bind(&current_user.id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    crate::audit::append(
        &state.db,
        &current_user.id,
        "project.create",
        "project",
        &id,
        &serde_json::json!({ "key": key, "name": req.name }).to_string(),
    )
    .await?;

    let project: Project = sqlx::query_as(
        "SELECT id, key, name, description, workspace_id, created_by, created_at FROM projects WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(project))
}

pub async fn get(
    _current_user: CurrentUser,
    State(state): State<AppState>,
    Path(project_id): Path<String>,
) -> AppResult<Json<Project>> {
    let project: Project = sqlx::query_as(
        "SELECT id, key, name, description, workspace_id, created_by, created_at FROM projects WHERE id = ?",
    )
    .bind(&project_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(project))
}
