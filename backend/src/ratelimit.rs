use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::extract::{ConnectInfo, Request, State};
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

const WINDOW: Duration = Duration::from_secs(300);
const MAX_ATTEMPTS: usize = 10;

/// Simple in-memory sliding-window limiter, keyed by client IP. Good enough for a
/// single-instance deployment; swap for a shared store (Redis, etc.) if this ever
/// runs behind multiple instances.
#[derive(Clone, Default)]
pub struct RateLimiter {
    hits: Arc<Mutex<HashMap<IpAddr, Vec<Instant>>>>,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self::default()
    }

    fn allow(&self, ip: IpAddr) -> bool {
        let mut hits = self.hits.lock().unwrap();
        let now = Instant::now();
        let entry = hits.entry(ip).or_default();
        entry.retain(|t| now.duration_since(*t) < WINDOW);
        if entry.len() >= MAX_ATTEMPTS {
            return false;
        }
        entry.push(now);
        true
    }
}

pub async fn limit_auth_attempts(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(limiter): State<RateLimiter>,
    request: Request,
    next: Next,
) -> Response {
    if limiter.allow(addr.ip()) {
        next.run(request).await
    } else {
        (
            StatusCode::TOO_MANY_REQUESTS,
            "too many attempts, please try again in a few minutes",
        )
            .into_response()
    }
}
