use axum::extract::{Path, State};
use axum::Json;
use uuid::Uuid;

use crate::auth::CurrentUser;
use crate::error::{AppError, AppResult};
use crate::models::{CreateLabelRequest, Label};
use crate::AppState;

pub async fn list(
    _current_user: CurrentUser,
    State(state): State<AppState>,
    Path(project_id): Path<String>,
) -> AppResult<Json<Vec<Label>>> {
    let labels: Vec<Label> = sqlx::query_as(
        "SELECT id, project_id, name, color FROM labels WHERE project_id = ? ORDER BY name ASC",
    )
    .bind(&project_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(labels))
}

pub async fn create(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Path(project_id): Path<String>,
    Json(req): Json<CreateLabelRequest>,
) -> AppResult<Json<Label>> {
    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("label name is required".into()));
    }
    let color = req.color.unwrap_or_else(|| "#888888".to_string());
    let id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO labels (id, project_id, name, color) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&project_id)
        .bind(&req.name)
        .bind(&color)
        .execute(&state.db)
        .await?;

    crate::audit::append(
        &state.db,
        &current_user.id,
        "label.create",
        "label",
        &id,
        &serde_json::json!({ "project_id": project_id, "name": req.name }).to_string(),
    )
    .await?;

    let label: Label = sqlx::query_as("SELECT id, project_id, name, color FROM labels WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(label))
}

pub async fn delete(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Path((_project_id, label_id)): Path<(String, String)>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query("DELETE FROM labels WHERE id = ?")
        .bind(&label_id)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    crate::audit::append(&state.db, &current_user.id, "label.delete", "label", &label_id, "{}").await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn for_task(
    _current_user: CurrentUser,
    State(state): State<AppState>,
    Path((_project_id, task_id)): Path<(String, String)>,
) -> AppResult<Json<Vec<Label>>> {
    let labels: Vec<Label> = sqlx::query_as(
        "SELECT l.id, l.project_id, l.name, l.color
         FROM labels l JOIN task_labels tl ON tl.label_id = l.id
         WHERE tl.task_id = ? ORDER BY l.name ASC",
    )
    .bind(&task_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(labels))
}

pub async fn assign(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Path((_project_id, task_id, label_id)): Path<(String, String, String)>,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query("INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)")
        .bind(&task_id)
        .bind(&label_id)
        .execute(&state.db)
        .await?;

    crate::audit::append(
        &state.db,
        &current_user.id,
        "task.label.assign",
        "task",
        &task_id,
        &serde_json::json!({ "label_id": label_id }).to_string(),
    )
    .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn unassign(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Path((_project_id, task_id, label_id)): Path<(String, String, String)>,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query("DELETE FROM task_labels WHERE task_id = ? AND label_id = ?")
        .bind(&task_id)
        .bind(&label_id)
        .execute(&state.db)
        .await?;

    crate::audit::append(
        &state.db,
        &current_user.id,
        "task.label.unassign",
        "task",
        &task_id,
        &serde_json::json!({ "label_id": label_id }).to_string(),
    )
    .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}
