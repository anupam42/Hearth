pub mod audit;
pub mod auth;
pub mod labels;
pub mod projects;
pub mod tasks;
pub mod tokens;
pub mod workspaces;

use axum::middleware;
use axum::routing::{delete, get, patch, post, put};
use axum::Router;

use crate::ratelimit::{limit_auth_attempts, RateLimiter};
use crate::AppState;

pub fn api_router() -> Router<AppState> {
    let limiter = RateLimiter::new();
    let auth_rate_limit = middleware::from_fn_with_state(limiter, limit_auth_attempts);

    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/auth/register", post(auth::register).layer(auth_rate_limit.clone()))
        .route("/auth/login", post(auth::login).layer(auth_rate_limit))
        .route("/auth/logout", post(auth::logout))
        .route("/auth/me", get(auth::me).patch(auth::update_profile))
        .route("/projects", get(projects::list).post(projects::create))
        .route("/projects/:project_id", get(projects::get))
        .route(
            "/projects/:project_id/tasks",
            get(tasks::list).post(tasks::create),
        )
        .route("/tasks/mine", get(tasks::mine))
        .route("/projects/:project_id/tasks/:task_id", patch(tasks::update))
        .route(
            "/projects/:project_id/labels",
            get(labels::list).post(labels::create),
        )
        .route("/projects/:project_id/labels/:label_id", delete(labels::delete))
        .route(
            "/projects/:project_id/tasks/:task_id/labels",
            get(labels::for_task),
        )
        .route(
            "/projects/:project_id/tasks/:task_id/labels/:label_id",
            put(labels::assign).delete(labels::unassign),
        )
        .route("/tokens", get(tokens::list).post(tokens::create))
        .route("/tokens/:token_id", delete(tokens::delete))
        .route("/audit", get(audit::list))
        .route("/audit/verify", get(audit::verify))
        .route("/workspaces", get(workspaces::list).post(workspaces::create))
}
