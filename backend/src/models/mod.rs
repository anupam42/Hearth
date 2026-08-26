use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct User {
    pub id: String,
    pub email: String,
    pub display_name: String,
    pub system_role: String,
    #[serde(skip_serializing)]
    pub password_hash: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub display_name: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Project {
    pub id: String,
    pub key: String,
    pub name: String,
    pub description: Option<String>,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub key: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Task {
    pub id: String,
    pub project_id: String,
    pub seq: i64,
    pub display_id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub assignee_id: Option<String>,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub assignee_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub assignee_id: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Workspace {
    pub id: String,
    pub key: String,
    pub name: String,
    pub description: Option<String>,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceRequest {
    pub key: String,
    pub name: String,
    pub description: Option<String>,
}
