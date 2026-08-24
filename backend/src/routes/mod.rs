pub mod audit;
pub mod auth;
pub mod projects;
pub mod tasks;

use axum::routing::{get, patch, post};
use axum::Router;

use crate::AppState;

pub fn api_router() -> Router<AppState> {
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/auth/register", post(auth::register))
        .route("/auth/login", post(auth::login))
        .route("/auth/logout", post(auth::logout))
        .route("/auth/me", get(auth::me))
        .route("/projects", get(projects::list).post(projects::create))
        .route("/projects/:project_id", get(projects::get))
        .route(
            "/projects/:project_id/tasks",
            get(tasks::list).post(tasks::create),
        )
        .route("/projects/:project_id/tasks/:task_id", patch(tasks::update))
        .route("/audit", get(audit::list))
        .route("/audit/verify", get(audit::verify))
}
