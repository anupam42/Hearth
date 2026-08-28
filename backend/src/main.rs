mod audit;
mod auth;
mod db;
mod error;
mod models;
mod ratelimit;
mod routes;

use std::net::SocketAddr;

use axum::extract::State;
use axum::http::{header, HeaderValue, StatusCode, Uri};
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
        .layer(cors_layer())
        .with_state(state);

    let addr = std::env::var("HEARTH_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".into());
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("hearth listening on {addr}");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}

/// Builds an explicit allow-list from `HEARTH_CORS_ORIGINS` (comma-separated) when set;
/// otherwise falls back to a permissive policy suitable for local dev only.
fn cors_layer() -> CorsLayer {
    match std::env::var("HEARTH_CORS_ORIGINS") {
        Ok(origins) => {
            let allowed: Vec<HeaderValue> = origins
                .split(',')
                .map(str::trim)
                .filter(|o| !o.is_empty())
                .filter_map(|o| o.parse().ok())
                .collect();
            CorsLayer::new()
                .allow_origin(allowed)
                .allow_methods(tower_http::cors::Any)
                .allow_headers(tower_http::cors::Any)
        }
        Err(_) => {
            tracing::warn!(
                "HEARTH_CORS_ORIGINS is not set — falling back to a permissive CORS policy. \
                 Set it to a comma-separated allow-list before deploying anywhere but localhost."
            );
            CorsLayer::permissive()
        }
    }
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
