use chrono::{DateTime, Utc};
use serde::Serialize;
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppResult;

#[derive(Serialize, sqlx::FromRow)]
pub struct AuditEntry {
    pub id: String,
    pub actor_id: String,
    pub action: String,
    pub entity_type: String,
    pub entity_id: String,
    pub details: String,
    pub prev_hash: String,
    pub hash: String,
    pub created_at: DateTime<Utc>,
}

/// Computes the hash for a chain link: sha256(prev_hash || actor_id || action || entity_type || entity_id || details || created_at)
fn compute_hash(
    prev_hash: &str,
    actor_id: &str,
    action: &str,
    entity_type: &str,
    entity_id: &str,
    details: &str,
    created_at: &DateTime<Utc>,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(prev_hash.as_bytes());
    hasher.update(actor_id.as_bytes());
    hasher.update(action.as_bytes());
    hasher.update(entity_type.as_bytes());
    hasher.update(entity_id.as_bytes());
    hasher.update(details.as_bytes());
    hasher.update(created_at.to_rfc3339().as_bytes());
    hex::encode(hasher.finalize())
}

pub const GENESIS_HASH: &str = "0000000000000000000000000000000000000000000000000000000000000000";

/// Appends a new entry to the audit log, chaining it to the previous entry's hash.
/// Must be called within a transaction that also commits the underlying action,
/// so the audit record and the action it describes are atomic together.
pub async fn append(
    pool: &SqlitePool,
    actor_id: &str,
    action: &str,
    entity_type: &str,
    entity_id: &str,
    details: &str,
) -> AppResult<AuditEntry> {
    let prev_hash: String = sqlx::query_scalar(
        "SELECT hash FROM audit_log ORDER BY created_at DESC, rowid DESC LIMIT 1",
    )
    .fetch_optional(pool)
    .await?
    .unwrap_or_else(|| GENESIS_HASH.to_string());

    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now();
    let hash = compute_hash(
        &prev_hash, actor_id, action, entity_type, entity_id, details, &created_at,
    );

    sqlx::query(
        "INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, details, prev_hash, hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(actor_id)
    .bind(action)
    .bind(entity_type)
    .bind(entity_id)
    .bind(details)
    .bind(&prev_hash)
    .bind(&hash)
    .bind(created_at)
    .execute(pool)
    .await?;

    Ok(AuditEntry {
        id,
        actor_id: actor_id.to_string(),
        action: action.to_string(),
        entity_type: entity_type.to_string(),
        entity_id: entity_id.to_string(),
        details: details.to_string(),
        prev_hash,
        hash,
        created_at,
    })
}

/// Walks the full audit log in order and verifies every hash links correctly to the previous one.
/// Returns Ok(()) if the chain is intact, or an error naming the first broken link.
pub async fn verify_chain(pool: &SqlitePool) -> AppResult<()> {
    let entries: Vec<AuditEntry> = sqlx::query_as(
        "SELECT id, actor_id, action, entity_type, entity_id, details, prev_hash, hash, created_at
         FROM audit_log ORDER BY created_at ASC, rowid ASC",
    )
    .fetch_all(pool)
    .await?;

    let mut expected_prev = GENESIS_HASH.to_string();
    for entry in &entries {
        if entry.prev_hash != expected_prev {
            return Err(anyhow::anyhow!(
                "audit chain broken at entry {}: expected prev_hash {}, found {}",
                entry.id,
                expected_prev,
                entry.prev_hash
            )
            .into());
        }
        let recomputed = compute_hash(
            &entry.prev_hash,
            &entry.actor_id,
            &entry.action,
            &entry.entity_type,
            &entry.entity_id,
            &entry.details,
            &entry.created_at,
        );
        if recomputed != entry.hash {
            return Err(anyhow::anyhow!(
                "audit chain tampered at entry {}: hash mismatch",
                entry.id
            )
            .into());
        }
        expected_prev = entry.hash.clone();
    }

    Ok(())
}
