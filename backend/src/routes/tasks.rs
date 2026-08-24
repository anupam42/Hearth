use axum::extract::{Path, State};
use axum::Json;
use uuid::Uuid;

use crate::auth::CurrentUser;
use crate::error::{AppError, AppResult};
use crate::models::{CreateTaskRequest, Task, UpdateTaskRequest};
use crate::AppState;

const VALID_PRIORITIES: &[&str] = &["low", "medium", "high", "urgent"];

pub async fn list(
    _current_user: CurrentUser,
    State(state): State<AppState>,
    Path(project_id): Path<String>,
) -> AppResult<Json<Vec<Task>>> {
    let tasks: Vec<Task> = sqlx::query_as(
        "SELECT id, project_id, seq, display_id, title, description, status, priority,
                assignee_id, created_by, created_at, updated_at
         FROM tasks WHERE project_id = ? ORDER BY seq ASC",
    )
    .bind(&project_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(tasks))
}

pub async fn create(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Path(project_id): Path<String>,
    Json(req): Json<CreateTaskRequest>,
) -> AppResult<Json<Task>> {
    let priority = req.priority.unwrap_or_else(|| "medium".to_string());
    if !VALID_PRIORITIES.contains(&priority.as_str()) {
        return Err(AppError::BadRequest("invalid priority".into()));
    }

    let mut tx = state.db.begin().await?;

    let project_key: String = sqlx::query_scalar("SELECT key FROM projects WHERE id = ?")
        .bind(&project_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    let seq: i64 = sqlx::query_scalar(
        "UPDATE projects SET next_task_seq = next_task_seq + 1 WHERE id = ? RETURNING next_task_seq - 1",
    )
    .bind(&project_id)
    .fetch_one(&mut *tx)
    .await?;

    let display_id = format!("{project_key}-{seq}");
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO tasks (id, project_id, seq, display_id, title, description, priority, assignee_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&project_id)
    .bind(seq)
    .bind(&display_id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(&priority)
    .bind(&req.assignee_id)
    .bind(&current_user.id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    crate::audit::append(
        &state.db,
        &current_user.id,
        "task.create",
        "task",
        &id,
        &serde_json::json!({ "display_id": display_id, "title": req.title }).to_string(),
    )
    .await?;

    let task: Task = sqlx::query_as(
        "SELECT id, project_id, seq, display_id, title, description, status, priority,
                assignee_id, created_by, created_at, updated_at
         FROM tasks WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(task))
}

pub async fn update(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Path((_project_id, task_id)): Path<(String, String)>,
    Json(req): Json<UpdateTaskRequest>,
) -> AppResult<Json<Task>> {
    if let Some(priority) = &req.priority {
        if !VALID_PRIORITIES.contains(&priority.as_str()) {
            return Err(AppError::BadRequest("invalid priority".into()));
        }
    }

    let existing: Task = sqlx::query_as(
        "SELECT id, project_id, seq, display_id, title, description, status, priority,
                assignee_id, created_by, created_at, updated_at
         FROM tasks WHERE id = ?",
    )
    .bind(&task_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let title = req.title.unwrap_or(existing.title);
    let description = req.description.or(existing.description);
    let status = req.status.unwrap_or(existing.status);
    let priority = req.priority.unwrap_or(existing.priority);
    let assignee_id = req.assignee_id.or(existing.assignee_id);

    sqlx::query(
        "UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, assignee_id = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    )
    .bind(&title)
    .bind(&description)
    .bind(&status)
    .bind(&priority)
    .bind(&assignee_id)
    .bind(&task_id)
    .execute(&state.db)
    .await?;

    crate::audit::append(
        &state.db,
        &current_user.id,
        "task.update",
        "task",
        &task_id,
        &serde_json::json!({ "status": status, "priority": priority }).to_string(),
    )
    .await?;

    let task: Task = sqlx::query_as(
        "SELECT id, project_id, seq, display_id, title, description, status, priority,
                assignee_id, created_by, created_at, updated_at
         FROM tasks WHERE id = ?",
    )
    .bind(&task_id)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(task))
}
