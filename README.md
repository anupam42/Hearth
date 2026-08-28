# Hearth

A self-hosted project and task tracker with password/token authentication and a tamper-evident audit log. (OIDC is planned, not yet implemented — see [Known gaps](#known-gaps).)

## Stack

- **Backend** — Rust, [axum](https://github.com/tokio-rs/axum), SQLite via [sqlx](https://github.com/launchbadge/sqlx)
- **Frontend** — TypeScript, no framework (custom reactive/router core), compiled with `tsc`
- The backend serves the compiled frontend as embedded static assets (via `rust-embed`), so a single binary runs the whole app

## Project layout

```
backend/          Rust API server
  src/
    routes/       HTTP handlers (auth, projects, tasks, labels, tokens, workspaces, audit)
    auth/         Password auth, session cookies, personal access tokens
    audit/        Hash-chained audit log
    db/           Database connection/setup
    models/       Shared data types
    ratelimit.rs  In-memory per-IP limiter for the auth routes
  migrations/      sqlx migrations

frontend/         TypeScript client
  src/
    core/         DOM helpers, router, reactive state, theme, drawer/dropdown, icons
    pages/        login, register, dashboard, projects, project, workspaces,
                   views, cycles, modules, settings, pomodoro
    api/          Backend API client
```

## Data model

Users belong to projects (`project_members`, with `guest`/`member`/`admin` roles). Each project has sequentially numbered tasks with status, priority, labels, and assignees, and can optionally belong to an admin-managed `workspace`. Every mutating action is recorded in a hash-chained `audit_log` table for tamper evidence.

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
- `HEARTH_JWT_SECRET` — secret used to sign session JWTs. **Defaults to a hardcoded dev value** (`dev-only-insecure-secret-change-me`) and logs a startup warning when unset — must be set to a real random secret before any non-local deployment.
- `HEARTH_CORS_ORIGINS` — comma-separated allow-list of origins (e.g. `https://app.example.com,https://staging.example.com`). Unset falls back to a permissive CORS policy with a startup warning — fine for local dev, not for anything else.
- `API_TARGET`, `PORT`, `LIVE_RELOAD` — frontend dev server only (see above)

## Auth

Two ways to authenticate against `/api`:

- **Session cookie** — issued by `POST /api/auth/login` (or `/auth/register`). Pass `"remember": false` in the login body for a browser-session-only cookie instead of the default 7-day persistent one.
- **Personal access token** — `Authorization: Bearer <token>`. Create one with `POST /api/tokens` (`{ "name": "...", "permission": "read" | "read_write", "expires_at": "<RFC3339>" }`, optional expiry); the raw token is returned **once**, in the create response, and never again — only its SHA-256 hash is stored. `permission: "read"` tokens are rejected with `403` on anything but `GET`/`HEAD`. `GET /api/tokens` lists your tokens (metadata only); `DELETE /api/tokens/:id` revokes one immediately.

`/api/auth/login` and `/api/auth/register` are rate-limited (10 attempts / 5 minutes / IP, in-memory — fine for a single instance, would need a shared store behind a load balancer).

## Known gaps

Things that exist partway — either scaffolded with no route/UI, or UI-only with nothing behind them. Listed so nobody mistakes them for finished:

- **Backend built, frontend not wired yet** — labels (`GET`/`POST`/`DELETE /api/projects/:id/labels`, assign/unassign on tasks), workspace-linked projects (`workspace_id` on `Project`, `?workspace_id=` filter on `GET /api/projects`), "my tasks" (`GET /api/tasks/mine`), account updates (`PATCH /api/auth/me`), and personal access tokens (`GET`/`POST /api/tokens`, `DELETE /api/tokens/:id`, bearer-token auth) are all real, tested routes now — but the frontend still shows the old placeholders: Settings' token UI is in-memory only, the dashboard's "Assigned to You" is hardcoded empty, there's no label picker on the task board, no account-settings page, and the "Showing all workspaces" toggle doesn't call the new query param yet.
- **OIDC / social login** — `openidconnect`/`oauth2` are in `Cargo.toml` and the DB schema (`oidc_provider`, `oidc_subject` on `users`) supports it, but no OIDC route is wired up. Password auth (cookie or PAT) is the only working login path.
- **Views, Cycles, Modules** — nav pages exist as empty states matching a reference design; no backend tables or routes behind any of them.
- **Pomodoro subtasks / attached task** — client-only state, not saved to a project/task on the backend.
- **Ambient sounds (Pomodoro)** — selectable in the UI, no actual audio wired up.
- **Search and notification bell (topbar)** — present in the UI, not functional.
- **Password reset / email verification** — no flow for either.

## Roadmap

Rough near-term priorities, roughly in order:

1. **Wire the frontend to the backend routes that already exist** — this is the biggest chunk of remaining value for the least new backend work. In order of payoff: Settings → real PAT create/list/revoke; dashboard "Assigned to You" → `GET /tasks/mine`; task board → label picker; Projects/Dashboard workspace toggle → `?workspace_id=`; a new account-settings page → `PATCH /auth/me`.
2. **Audit trail UI** — `GET /api/audit` and `/api/audit/verify` are fully implemented backend-side and have *no frontend consumer at all*. A project activity feed + a "verify integrity" button is mostly wiring, not new backend work.
3. Move Pomodoro subtasks/attached-task from `localStorage` onto the task model, so a focus session can genuinely tie back to a real task.
4. Drag-and-drop on the task board (react to reordering, not just the status `<select>`).
5. Real-time updates (SSE or WebSocket) so multiple people looking at the same project see changes live — the audit log already has the event stream to hang this off of.

### Pro / stretch ideas

Bigger swings, no particular order:

- **OIDC login** (Google/GitHub/generic) using the already-present `openidconnect` dependency and schema columns.
- **Postgres option** alongside SQLite for teams that outgrow single-writer SQLite — `sqlx` already abstracts most of this; the migrations would need a Postgres-compatible variant.
- **Full-text search** across tasks/projects (SQLite FTS5, or Postgres `tsvector` if that migration happens first) to back the topbar search icon for real.
- **Webhooks / integrations** off the audit log (Slack/Discord notification on task state changes, etc.) — the hash-chained log is a natural event source.
- **Role-based project permissions UI** — `project_members.role` (`guest`/`member`/`admin`) exists in the schema but there's no UI to manage it per-project.
- **Exportable audit trail** (CSV/JSON download of the hash-chained log) for compliance use cases — pairs with the existing `/api/audit/verify` integrity check.
- **Mobile-optimized layouts** beyond the current responsive breakpoints (a real PWA manifest + offline shell).
- **Task comments / activity feed** — threaded discussion per task, stored server-side, surfaced in a task-detail drawer (the `Drawer` component already exists for this).
- **File attachments on tasks** — upload to local disk or S3-compatible storage, linked via a new table; shown alongside comments.
- **Real notifications** — the topbar bell is currently decorative. A `notifications` table + read/unread state, populated on assignment/comment/mention, would make it real.
- **@mentions** in task descriptions/comments, parsed server-side, feeding the notification system above.
- **Task dependencies** ("blocked by" / "blocks" links between tasks), visualized on the board.
- **Time tracking tied to Pomodoro** — let a focus session log against a specific task (depends on the Pomodoro-subtasks-to-backend roadmap item above), with a per-task/per-project time report.
- **Custom fields per project** — admin-defined extra fields on tasks (text/select/number), stored as JSON or an EAV table.
- **Functional saved Views** — the "Views" nav page is currently an empty state; persisting a named filter/sort combination server-side (with a shareable link) would make it real.
- **Bulk task operations** — multi-select on the board, bulk status/assignee/label change in one request.
- **Command palette (⌘K)** — quick navigate-to-project/task and run-action UI; a natural frontend pairing for the full-text search item above.
- **Two-factor authentication (TOTP)** — backend secret generation/verification + a frontend QR-code setup flow.
- **Project/task templates** — spin up a new project pre-populated with a standard task/column set.

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

- Set `HEARTH_JWT_SECRET` and `HEARTH_CORS_ORIGINS` to real values — both now default to permissive/insecure with a startup warning if unset, precisely so this is easy to spot in logs before it bites you.
- Terminate TLS in front of the binary (the platform's load balancer, or a `Caddy`/`nginx` sidecar) — axum serves plain HTTP.
- The in-memory rate limiter on `/auth/login` and `/auth/register` (10 attempts / 5 min / IP) only works for a single instance — swap it for a shared store (Redis, etc.) before running more than one.
- **No automated tests exist yet** (backend or frontend) — worth having at least auth + PAT + audit-log-integrity coverage before this runs anything real.
