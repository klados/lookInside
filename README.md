# lookInside

Session replay and visitor analytics for campaigns.

lookInside lets website owners install a lightweight tracking script on their site, record real visitor sessions (mouse movements, scrolls, input, page state), and later replay them pixel-perfect from a dashboard. Sessions are tied to **campaigns** — each campaign defines which domains are allowed to send data, a session limit, and a start/end window.

## Features

* Google OAuth sign-in (no passwords) with HTTP-only cookie auth (short-lived JWT access token + rotating refresh token)
* Campaign management: create/delete campaigns, allowed-domain allowlist, session caps, date windows (max 5 campaigns per user)
* One-click tracking script per campaign — served as `magicFormat.js`, automatically minified with the campaign ID and API URL injected
* **rrweb**-based session recording streamed in batches, flushed with `sendBeacon` on unload
* Session list with bot/human classification (webdriver flag) and country-of-origin enrichment
* Pixel-perfect replay player (`rrweb-player`)
* Google OAuth disabled-by-default public demo replay
* Daily Discord report summarizing the previous day's campaigns and session activity (`report-tool`)
* TimescaleDB hypertables for time-series event data with automatic retention

## Architecture

```
Browser (visitor site)                 lookInside server
┌──────────────────────┐        ┌──────────────────────────────────────────────┐
│ magicFormat.js (rrweb)│  POST  │  Gin backend (Go)      React dashboard (Vite)│
│ records & batches    │ ─────► │   /external/api/v1/streaming/*               │
│ events every ~5s     │        │        │                                      │
└──────────────────────┘        │   ┌────▼────┐     ┌─────────┐                │
                                │   │Timescale│     │ n/a     │                │
                                │   │DB (PG16)│◄───►│         │                │
                                │   └─────────┘     │  Redis  │ (rate limits, │
                                │                   └─────────┘  session caps)│
                                │        │                                      │
                            ┌───▼───────┐                                      │
                            │ replay API│  ──► owner views recording in dashboard│
                            └───────────┘                                      │
```

* **Backend**: Go + Gin + GORM. Serves the API, the tracking script, and the built React app.
* **Database**: [TimescaleDB](https://www.timescale.com/) (PostgreSQL 16) — rrweb events and session metadata in hypertables.
* **Cache / limits**: Redis — per-campaign session-id Sets (enforce session caps) and campaign cache.
* **Frontend**: Vite 7 + React 19 + Tailwind 4 + rrweb-player.
* **Tracking script**: `static/magicFormat.js` is an rrweb bundle plus a small recorder that auto-starts on page load.

## Repository structure

```
cmd/
  main.go            server entrypoint (runs migrations, starts HTTP/TLS listener)
  report-tool/       standalone daily Discord report binary
config/              env loading, DB + Redis clients
handlers/            HTTP handlers (auth, campaign, streaming, replay)
services/            business logic (campaign CRUD, reports, replay assembly)
repositories/        data access (GORM, Redis session tracking)
routers/             Gin route registration
middleware/          auth + streaming rate/limit guard
models/              GORM models
dto/                 request/response structs
helpers/             JWT, CORS, Discord webhook helpers
migrations/          golang-migrate SQL files
static/              magicFormat.js tracking script
frontEnd/            Vite + React dashboard
config/              env template
docker-compose.yml   app + db + redis + report-tool stack
.github/workflows/   deploy pipeline (SSH + docker compose)
```

## Tech stack

| Layer | Technology |
|---|---|
| Language | Go 1.24 |
| Web framework | Gin |
| ORM | GORM |
| Database | TimescaleDB (PostgreSQL 16) |
| Cache | Redis 7 |
| Frontend | Vite 7, React 19, TypeScript, Tailwind 4 |
| Recording / replay | rrweb, rrweb-player |

## Prerequisites

* Docker + Docker Compose (for the quick-start path)
* Go 1.24, Node 20+ (for local development)
* The `golang-migrate` CLI **must be installed and on `PATH`** — the server runs `migrate` on every startup (`cmd/main.go`)
* TimescaleDB, not plain PostgreSQL (migrations enable the `timescaledb` extension and create hypertables)
* Redis

## Quick start (Docker)

```bash
cp env-example .env
# fill in the required variables (see Configuration below)
docker compose up -d --build
```

The stack starts four services: `db` (TimescaleDB), `redis`, `app` (server + frontend, HTTPS on 443), and `report-tool` (runs once a day). The `.env` file is read by the DB/Redis services, so it is required even in Docker deployments.

`app` expects TLS certificates mounted at `/certs/fullchain.pem` and `/certs/privkey.pem` (see `TLS_CERT_FILE` / `TLS_KEY_FILE`).

## Local development

### 1. Backend

```bash
cp env-example .env
# set DB_USER, DB_PASSWORD, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET (startup fails without them)
go run ./cmd
```

Migrations run automatically on startup (via the `migrate` CLI). The server listens on `http://localhost:8080`.

### 2. Frontend

```bash
cd frontEnd
npm install
cp env_example .env.local
# VITE_API_BASE_URL=http://localhost:8080
# VITE_GOOGLE_CLIENT_ID=<your-client-id>
npm run dev
```

The dev server runs on `http://localhost:5173`. In `GIN_MODE=debug` the backend enables CORS for `localhost:5173`, and OAuth cookies are set as non-Secure when `ENVIRONMENT` is a dev value, so the local flow works over plain HTTP.

### Migrations

Create a new migration:

```bash
migrate create -ext sql -dir migrations -seq <migration_name>
```

Run migrations manually (they also run automatically at server startup):

```bash
migrate -path migrations \
  -database "postgresql://<user>:<password>@localhost:5432/<dbname>?sslmode=disable" \
  -verbose up
```

## Configuration

All settings come from environment variables (`.env` via [godotenv](https://github.com/joho/godotenv)). **Bold** variables are required — the server exits if any is missing.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DB_USER` | **yes** | — | Database user |
| `DB_PASSWORD` | **yes** | — | Database password |
| `DB_HOST` | no | `localhost` | `db` under docker compose |
| `DB_PORT` | no | `5432` | |
| `DB_NAME` | no | `look_inside` | |
| `DB_SSLMODE` | no | `disable` | |
| `GOOGLE_CLIENT_ID` | **yes** | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | **yes** | — | Google OAuth client secret |
| `JWT_SECRET` | **yes** | — | Secret used to sign auth cookies |
| `SERVER_HOST` | no | `localhost` | `0.0.0.0` under docker compose |
| `SERVER_PORT` | no | `8080` | `443` under docker compose |
| `GIN_MODE` | no | `debug` | `release` enables HTTPS + static frontend serving |
| `GOOGLE_REDIRECT_URL` | no | `http://localhost:8080/auth/google/callback` | Must point to `<base>/api/v1/auth/google/callback` in production |
| `ENVIRONMENT` | no | — | `prod` sets SameSite=None + Secure cookies; dev values allow local cookie flow |
| `COOKIE_DOMAIN` | no | — | `Domain` attribute for auth cookies |
| `TLS_CERT_FILE` / `TLS_KEY_FILE` | no | — | When both set, the server serves HTTPS |
| `REDIS_ADDR` | no | `localhost:6379` | `redis:6379` under docker compose |
| `REDIS_PASSWORD` | no | — | |
| `DISCORD_NEW_USER_WEBHOOK` | no | — | Webhook notified on new signups |
| `DISCORD_REPORT_WEBHOOK` | no | — | Destination for the daily `report-tool` summary |
| `CORS_ALLOWED_ORIGINS` | no | `http://localhost:5173` | Extra allowed origins for CORS (not in `env-example`) |

Frontend build-time variables (baked in by Vite at build time, also passed as docker build args):

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID used by the login button |

> Note: `TIMESCALE_RETENTION_POLICY` and `TIMESCALE_CHUNK_TIME_INTERVAL` in `env-example` are documented but currently not read by the application code.

## Usage

1. **Sign in** with your Google account (the login button on the landing page).
2. **Create a campaign** (`/createCampaign`): give it a name, allowed domains/IPs (comma-separated), a session limit, and a start/end date window. A user can have up to 5 campaigns.
3. **Copy the tracking script** from the dashboard. The dashboard fetches `magicFormat.js`, injects the campaign ID and API URL, and minifies it in-browser — then download or copy it and drop it into your site.
4. **Visitors are recorded**: the script records and streams rrweb events to `/external/api/v1/streaming/init` and `/external/api/v1/streaming/events` in ~5s batches.
5. **Watch replays**: open a campaign to see its session list (with bot/human badge and country), then open a session to replay it in the player.

The ingestion endpoint validates on every batch that the campaign exists, is within its date window, the client IP is allowlisted, and the session cap isn't exceeded (Redis-backed).

## API reference

All internal endpoints live under `/api/v1`. Session ingestion is public under `/external/api/v1/streaming`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/refresh` | cookie | Rotate refresh token into new access + refresh cookies |
| POST | `/api/v1/auth/logout` | cookie | Revoke refresh token, clear cookies |
| GET | `/api/v1/auth/google/callback` | — | Google OAuth callback (also accepts `code` in a POST body) |
| GET | `/api/v1/auth/me` | JWT | Current user |
| POST | `/external/api/v1/streaming/init` | — | Register session start (fingerprint/init data); rate-limited |
| POST | `/external/api/v1/streaming/events` | — | Ingest a batch of rrweb events; rate-limited |
| GET | `/api/v1/streaming/sessions/:campaignId/` | JWT | List sessions for a campaign |
| GET | `/api/v1/replay/retrieve/:projectId/:sessionId` | JWT | Fetch init data + events to render a replay |
| GET | `/api/v1/replay/retrieve/demo` | — | Demo replay events (`?isMobile=true`) |
| POST | `/api/v1/campaign/create` | JWT | Create a campaign |
| GET | `/api/v1/campaign/getAll` | JWT | List the user's campaigns |
| DELETE | `/api/v1/campaign/delete/:campaignId` | JWT | Delete a campaign and its streaming data |
| GET | `/static/magicFormat.js` | — | Serve the base tracking script |
| GET | `/`, `/assets/*`, `/favicon.ico` | — | Serve the built React app (production) |

## Daily Discord report

`cmd/report-tool` is a standalone binary that queries the previous day's UTC window and posts a summary to `DISCORD_REPORT_WEBHOOK`: newly created campaigns (with owner e-mail) and per-campaign session activity. In docker compose it runs once per day via a `sleep 86400` loop.

## Database schema

Migrations live in `migrations/` (golang-migrate):

| Table | Purpose |
|---|---|
| `init_connection_streamings` | Session metadata (IP, user agent, language, geo, webdriver/bot flag, timezone, etc.) — TimescaleDB hypertable |
| `event_streaming` | Raw rrweb events (`timestamp`, `type`, `data` JSONB) — hypertable |
| `campaigns` | Campaigns (name, allowed domains, session limit, date window, owner) |
| `users` | Google-authenticated users (email, name, picture, role, blocked flag) |
| `refresh_tokens` | Refresh-token rotation records (revoked flag, expiry, user agent, IP) |

## Security notes

* Never expose Redis or PostgreSQL publicly. The compose stack maps them to host ports for convenience — restrict them to localhost and rely on the HTTP stack for remote access:
  ```bash
  sudo ufw deny 6379   # redis
  sudo ufw deny 5432   # postgresql
  ```
* The container in `docker-compose.yml` runs as root only so it can read Let's Encrypt certificates; run as a non-root user if you can mount world-readable certs.
* Login is Google OAuth only, with HTTP-only auth cookies. The refresh token rotates on use; expired tokens are purged by a background janitor (every 30 minutes).
* No secrets belong in this repository — see `env-example` and store real values in `.env` (git-ignored) or your CI secret store.

## Privacy

The tracking script records visitor sessions (page state, mouse, scrolls, and input) and can read geolocation and device fingerprint data. If you deploy this publicly, you are responsible for compliance — obtain visitor consent where required, mask sensitive fields, and publish a privacy policy. Configure it to record only what you truly need.