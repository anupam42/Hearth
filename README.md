# Hearth

A self-hosted project and task tracker with password/token authentication and a tamper-evident audit log. (OIDC is planned, not yet implemented — see [Status](#status).)

## Status

At-a-glance picture of what's real vs. what's still a placeholder. Checked = built, tested, working end-to-end.

### Backend

- [x] Password auth (register/login/logout), argon2 hashing
- [x] Session cookies (JWT) with "remember me" (persistent vs. session-only cookie)
- [x] Sliding session expiration — 45-min idle timeout, `/auth/refresh` slides it forward, 7-day absolute cap from original login regardless of activity
- [x] Personal access tokens — create/list/revoke, bearer auth, `read` vs `read_write` enforced
- [x] Rate limiting on `/auth/login` + `/auth/register` (in-memory, per-IP)
- [x] CORS allow-list via `HEARTH_CORS_ORIGINS`, warns on the permissive fallback
- [x] Projects — create/list/get, scoped to project members
- [x] Tasks — create/list/update (status, priority, assignee)
- [x] Labels — create/list/delete, assign/unassign to tasks
- [x] Workspaces — admin-only create/list, linked to projects via `workspace_id`, filterable
- [x] "My tasks" — cross-project endpoint for the current user
- [x] Account update — change display name / email / password (`PATCH /auth/me`)
- [x] Hash-chained audit log — append on every mutation, `/audit/verify` integrity check
- [ ] OIDC / social login
- [ ] Password reset / email verification
- [ ] Automated tests (none exist yet — backend or frontend)
- [ ] Postgres option (needed for multi-instance; SQLite is single-writer)
- [ ] Notifications, task comments, file attachments — no backend at all yet
- [ ] Full-text search

### Frontend

- [x] Login / Register — shared split-panel layout, password visibility toggle, remember-me
- [x] Dashboard, Projects list, Project task board
- [x] Workspaces page (admin-only nav gating)
- [x] Views / Cycles / Modules — empty-state pages
- [x] Settings page — categorized layout (left nav + section cards: Notifications, Personal Access Tokens); PAT create/list/revoke wired to `/tokens`, one-time secret reveal with copy-to-clipboard
- [x] Pomodoro — three real modes (fixed-cycle Pomodoro, preset Countdown, open-ended Tracking stopwatch), dot-matrix timer, real localStorage-backed analytics, subtasks (client-only)
- [x] Light/dark/system theme, light as the default
- [x] Slide-in Drawer used for every creation flow (projects, tasks, workspaces, tokens)
- [x] Brand color system + mascot icon/favicon
- [x] Hot-reload dev server
- [x] Branded loading screen (pulsing mascot) for the initial auth check
- [x] 404 / 403 / 500 error pages — real mascot illustration, subtle float animation; 403 fires on admin-gated routes, 500 fires on genuine backend/gateway unreachability (tested by killing the backend)
- [x] Toast notification system — success/error/warning/info, enter/exit animations, "click to stop" auto-dismiss, wired into project/task/workspace/token create flows
- [x] Notification position setting (Settings page, 4-corner picker, persisted, live preview button)
- [x] Sliding-session client — tracks real activity, calls `/auth/refresh` every ~10 min while active; a genuine 401 while logged in clears state, redirects to `/login`, and shows a "signed out" toast
- [ ] Wire dashboard "Assigned to You" to `GET /tasks/mine`
- [ ] Label picker / assignment on the task board
- [ ] Wire the "Showing all workspaces" toggle to `?workspace_id=`
- [ ] Account-settings page wired to `PATCH /auth/me` (no edit-profile UI exists yet)
- [x] Audit trail UI — admin-only feed with real actor names (`GET /audit` now joins `users`), relative timestamps, per-action icons, truncated hash badges, and a "Verify Integrity" button wired to `/audit/verify` (tested against real tampering — corrupted a row directly in SQLite and confirmed the UI correctly reported the exact broken entry, then restored it)
- [ ] Drag-and-drop task board (status changes only via `<select>` today)
- [ ] Real-time updates (SSE/WebSocket)
- [ ] Functional search — topbar search icon and bell are still decorative (bell will make sense once the notifications backend from the Pro/stretch list exists)

### Ops & deployment

- [ ] Dockerfile / containerization
- [ ] CI pipeline (lint + typecheck + test on every PR)
- [ ] Hosting/deploy target configured
- [ ] Backup strategy for the SQLite file
- [ ] TLS termination in front of the binary
- [ ] Shared-store rate limiter (only needed once running >1 instance)

See [Deployment](#deployment) below for the suggested shape of all of this.

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

- **Session cookie** — issued by `POST /api/auth/login` (or `/auth/register`). Pass `"remember": false` in the login body for a browser-session-only cookie instead of the default persistent one. The token itself carries a **45-minute idle timeout** independent of the cookie's own lifetime — call `POST /api/auth/refresh` (with the current, still-valid cookie) to slide it forward another 45 minutes. There's also a **7-day absolute cap** from the original login that refreshing can't extend, so an always-active session still eventually needs a real re-login. The frontend does this automatically: it tracks real user activity and calls `/auth/refresh` every ~10 minutes while active, so in practice you only see the 45-minute window if you actually walk away.
- **Personal access token** — `Authorization: Bearer <token>`. Create one with `POST /api/tokens` (`{ "name": "...", "permission": "read" | "read_write", "expires_at": "<RFC3339>" }`, optional expiry); the raw token is returned **once**, in the create response, and never again — only its SHA-256 hash is stored. `permission: "read"` tokens are rejected with `403` on anything but `GET`/`HEAD`. `GET /api/tokens` lists your tokens (metadata only); `DELETE /api/tokens/:id` revokes one immediately.

`/api/auth/login` and `/api/auth/register` are rate-limited (10 attempts / 5 minutes / IP, in-memory — fine for a single instance, would need a shared store behind a load balancer).

## Pro / stretch ideas

Bigger swings, not committed to — a wishlist, not a roadmap:

- [ ] **OIDC login** (Google/GitHub/generic) using the already-present `openidconnect` dependency and schema columns
- [ ] **Postgres option** alongside SQLite for teams that outgrow single-writer SQLite
- [ ] **Full-text search** across tasks/projects, to back the topbar search icon for real
- [ ] **Webhooks / integrations** off the audit log (Slack/Discord on task state changes, etc.)
- [ ] **Role-based project permissions UI** — `project_members.role` exists in the schema, no UI to manage it
- [ ] **Exportable audit trail** (CSV/JSON download) for compliance use cases
- [ ] **Mobile-optimized layouts** beyond the current responsive breakpoints — a real PWA
- [ ] **Task comments / activity feed** — the `Drawer` component already exists for this
- [ ] **File attachments on tasks**
- [ ] **Real notifications** — `notifications` table + read/unread state
- [ ] **@mentions** in descriptions/comments, feeding the notification system above
- [ ] **Task dependencies** ("blocked by" / "blocks")
- [ ] **Time tracking tied to Pomodoro** — a focus session logging against a specific task
- [ ] **Custom fields per project**
- [ ] **Functional saved Views** — persist a named filter/sort combination, shareable
- [ ] **Bulk task operations** — multi-select, bulk status/assignee/label change
- [ ] **Command palette (⌘K)**
- [ ] **Two-factor authentication (TOTP)**
- [ ] **Project/task templates**

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

- [ ] Set `HEARTH_JWT_SECRET` and `HEARTH_CORS_ORIGINS` to real values — both now default to permissive/insecure with a startup warning if unset, precisely so this is easy to spot in logs before it bites you.
- [ ] Terminate TLS in front of the binary (the platform's load balancer, or a `Caddy`/`nginx` sidecar) — axum serves plain HTTP.
- [ ] Swap the in-memory rate limiter for a shared store (Redis, etc.) before running more than one instance.
- [ ] Add automated tests — at least auth + PAT + audit-log-integrity coverage before this runs anything real.
