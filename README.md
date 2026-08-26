# Hearth

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
    core/         DOM helpers, router, reactive state, theme, drawer/dropdown, icons
    pages/        login, register, dashboard, projects, project, workspaces,
                   views, cycles, modules, settings, pomodoro
    api/          Backend API client
```

## Data model

Users belong to projects (`project_members`, with `guest`/`member`/`admin` roles). Each project has sequentially numbered tasks with status, priority, labels, and assignees. `workspaces` exist as an admin-only grouping (not yet linked to projects — see [Known gaps](#known-gaps)). Every mutating action is recorded in a hash-chained `audit_log` table for tamper evidence.

## Development

### Backend

```bash
cd backend
cargo run
```

Runs on `HEARTH_ADDR` (default `0.0.0.0:8080`), backed by the SQLite database at `DATABASE_URL` (default `sqlite://hearth.db`). Migrations in `backend/migrations/` run automatically on startup.

### Frontend

```bash
cd frontend
npm install
npm run dev     # tsc --watch + asset watch + dev server + live reload, all in one
```

`npm run dev` proxies `/api` to `API_TARGET` (default `http://localhost:8080` — point it at your backend's `HEARTH_ADDR`, e.g. `API_TARGET=http://localhost:8090 npm run dev`), serves on `PORT` (default `5173`), and pushes a browser reload over SSE whenever `src/` changes. Set `LIVE_RELOAD=0` to disable that. `npm run watch` (tsc only) and `npm run serve` (server only, no live reload) are available separately if you'd rather run them in two terminals.

Run `npm run build` in `frontend/` before `cargo run`/`cargo build` in `backend/` so the backend has a `frontend/dist/` to embed for a real single-binary run.

## Environment variables

- `DATABASE_URL` — SQLite connection string (default `sqlite://hearth.db`)
- `HEARTH_ADDR` — address to bind (default `0.0.0.0:8080`)
- `HEARTH_JWT_SECRET` — secret used to sign session JWTs. **Defaults to a hardcoded dev value** (`dev-only-insecure-secret-change-me`) — must be set to a real random secret before any non-local deployment.
- `API_TARGET`, `PORT`, `LIVE_RELOAD` — frontend dev server only (see above)

## Known gaps

Things that exist partway — either scaffolded with no route/UI, or UI-only with nothing behind them. Listed so nobody mistakes them for finished:

- **OIDC / social login** — `openidconnect`/`oauth2` are in `Cargo.toml` and the DB schema (`oidc_provider`, `oidc_subject` on `users`) supports it, but no OIDC route is wired up. Password auth is the only working login path.
- **Labels** — `labels` and `task_labels` tables exist in the schema; there's no backend route or frontend UI to create, assign, or filter by them.
- **Workspaces ↔ Projects** — workspaces (admin-only) can be created, but projects have no `workspace_id` and the "Showing all workspaces" toggle on Projects/Dashboard is decorative.
- **Views, Cycles, Modules** — nav pages exist as empty states matching a reference design; no backend tables or routes behind any of them.
- **"Assigned to You" (dashboard)** — always empty; there's no cross-project "my tasks" query yet.
- **Personal Access Tokens (Settings)** — the create-token UI is entirely client-side (in-memory), not persisted or usable for real API auth.
- **Pomodoro subtasks / attached task** — client-only state, not saved to a project/task on the backend.
- **Ambient sounds (Pomodoro)** — selectable in the UI, no actual audio wired up.
- **Search and notification bell (topbar)** — present in the UI, not functional.
- **Password reset / email verification** — no flow for either.

## Roadmap

Rough near-term priorities, roughly in order:

1. Wire labels end-to-end (routes + task board UI) — the schema's already there.
2. Link projects to workspaces (`workspace_id` + migration) and make the workspace toggle actually filter.
3. A real "my tasks" endpoint for the dashboard's "Assigned to You" section.
4. Persist Personal Access Tokens server-side (hashed, scoped read/read-write, actually usable as a bearer token against `/api`).
5. Move Pomodoro subtasks/attached-task from `localStorage` onto the task model, so a focus session can genuinely tie back to a real task.
6. Drag-and-drop on the task board (react to reordering, not just the status `<select>`).
7. Real-time updates (SSE or WebSocket) so multiple people looking at the same project see changes live — the audit log already has the event stream to hang this off of.

### Pro / stretch ideas

Bigger swings, no particular order:

- **OIDC login** (Google/GitHub/generic) using the already-present `openidconnect` dependency and schema columns.
- **Postgres option** alongside SQLite for teams that outgrow single-writer SQLite — `sqlx` already abstracts most of this; the migrations would need a Postgres-compatible variant.
- **Full-text search** across tasks/projects (SQLite FTS5, or Postgres `tsvector` if that migration happens first) to back the topbar search icon for real.
- **Webhooks / integrations** off the audit log (Slack/Discord notification on task state changes, etc.) — the hash-chained log is a natural event source.
- **Role-based project permissions UI** — `project_members.role` (`guest`/`member`/`admin`) exists in the schema but there's no UI to manage it per-project.
- **Exportable audit trail** (CSV/JSON download of the hash-chained log) for compliance use cases — pairs with the existing `/api/audit/verify` integrity check.
- **Mobile-optimized layouts** beyond the current responsive breakpoints (a real PWA manifest + offline shell).

## Deployment

Nothing here yet — no Dockerfile, CI workflow, or hosting config exists in the repo today. Suggested path when that becomes a priority:

### Containerizing

A multi-stage `Dockerfile` works well given the single-binary architecture:

1. **Stage 1** (`node:20`) — `npm ci && npm run build` in `frontend/` to produce `frontend/dist/`.
2. **Stage 2** (`rust:1-slim`) — `cargo build --release` in `backend/`, with `frontend/dist/` present so `rust-embed` bakes the compiled frontend into the binary.
3. **Stage 3** (`debian:slim` or `gcr.io/distroless/cc`) — copy just the release binary and `backend/migrations/` in; run it. Mount a volume for the SQLite file and set `DATABASE_URL` to point at it.

A `docker-compose.yml` wrapping that image (plus a named volume for the DB) would give a one-command local prod-like run.

### CI/CD pipeline (suggested GitHub Actions shape)

- **On every PR**: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` (once tests exist — see below), `npx tsc --noEmit` in `frontend/`.
- **On merge to `main`**: build the Docker image, push to a registry (GHCR is free and zero-config with GitHub Actions), then deploy.
- **Deploy target**: given the single SQLite-backed binary, [Fly.io](https://fly.io) (persistent volumes, cheap, deploys a Dockerfile directly) or a small VPS running the container under `systemd`/`docker compose` are the least-friction options. Avoid a multi-instance/autoscaled deploy until the Postgres migration above happens — concurrent writers against one SQLite file don't work.
- **Backups**: since this is SQLite, either a scheduled `sqlite3 .backup` cron copying to object storage, or [Litestream](https://litestream.io/) for continuous streaming replication to S3-compatible storage — cheap insurance before this holds anything you can't lose.

### Before any real deployment

- Replace the default `HEARTH_JWT_SECRET` with a real generated secret (deployment platform's secret manager, not committed anywhere).
- Tighten `CorsLayer::permissive()` in `backend/src/main.rs` to an explicit allowed-origin list.
- Add rate limiting on `/api/auth/login` and `/api/auth/register` (no brute-force protection currently exists).
- Terminate TLS in front of the binary (the platform's load balancer, or a `Caddy`/`nginx` sidecar) — axum serves plain HTTP.
- **No automated tests exist yet** (backend or frontend) — worth having at least auth + audit-log-integrity coverage before this runs anything real.
