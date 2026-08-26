mod audit;
mod auth;
mod db;
mod error;
mod models;
mod routes;

use axum::extract::State;
use axum::http::{header, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::Router;
use rust_embed::RustEmbed;
use sqlx::SqlitePool;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

#[derive(RustEmbed)]
#[folder = "../frontend/dist/"]
struct FrontendAssets;

#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "hearth=debug,tower_http=info".into()),
        )
        .init();

    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite://hearth.db".into());
    let db = db::connect(&database_url).await?;

    let state = AppState { db };

    let app = Router::new()
        .nest("/api", routes::api_router())
        .fallback(static_handler)
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = std::env::var("HEARTH_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".into());
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("hearth listening on {addr}");
    axum::serve(listener, app).await?;

    Ok(())
}

async fn static_handler(State(_state): State<AppState>, uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    match FrontendAssets::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
        }
        None => match FrontendAssets::get("index.html") {
            Some(content) => {
                ([(header::CONTENT_TYPE, "text/html")], content.data).into_response()
            }
            None => (StatusCode::NOT_FOUND, "not found").into_response(),
        },
    }
}
