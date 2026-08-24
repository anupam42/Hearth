# Snorlax

A self-hosted project and task tracker with OIDC/password authentication and a tamper-evident audit log.

## Stack

- **Backend** — Rust, [axum](https://github.com/tokio-rs/axum), SQLite via [sqlx](https://github.com/launchbadge/sqlx)
- **Frontend** — TypeScript, no framework (custom reactive/router core), compiled with `tsc`
- The backend serves the compiled frontend as embedded static assets (via `rust-embed`), so a single binary runs the whole app

## Project layout

```
backend/          Rust API server
  src/
    routes/       HTTP handlers (auth, projects, tasks, audit)
    auth/         OIDC + password authentication
    audit/        Hash-chained audit log
    db/           Database connection/setup
    models/       Shared data types
  migrations/      sqlx migrations

frontend/         TypeScript client
  src/
    core/         DOM helpers, router, reactive state
    pages/        App pages (login, register, dashboard, project)
    api/          Backend API client
```

## Data model

Users belong to projects (`project_members`, with `guest`/`member`/`admin` roles). Each project has sequentially numbered tasks with status, priority, labels, and assignees. Every mutating action is recorded in a hash-chained `audit_log` table for tamper evidence.

## Development

### Backend

```bash
cd backend
cargo run
```

Runs on `SNORLAX_ADDR` (default `0.0.0.0:8080`), backed by the SQLite database at `DATABASE_URL` (default `sqlite://snorlax.db`).

### Frontend

```bash
cd frontend
npm install
npm run watch   # tsc --watch
npm run serve   # local dev server
```

Run `npm run build` in `frontend/` before `cargo run`/`cargo build` in `backend/` so the backend has a `frontend/dist/` to embed.

## Environment variables

- `DATABASE_URL` — SQLite connection string (default `sqlite://snorlax.db`)
- `SNORLAX_ADDR` — address to bind (default `0.0.0.0:8080`)
