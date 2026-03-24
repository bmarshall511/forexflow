---
title: "Cloud Deployment"
description: "Deploy the FXFlow daemon to Railway or Fly.io with a Turso cloud database."
category: "dev"
order: 8
---

# Cloud Deployment

## Overview

Cloud deployment runs the FXFlow daemon on a remote server so it stays online 24/7, even when your local machine is off. This is essential for automated trading features (TradingView alerts, Trade Finder auto-trade, EdgeFinder) that need continuous market monitoring.

The architecture is:

```
Web App (local or desktop)  ←→  Daemon (Railway / Fly.io)  ←→  OANDA API
                                      ↕
                                Turso (cloud SQLite)
```

- **Daemon**: containerized Node.js process deployed via Docker.
- **Database**: Turso (hosted LibSQL, wire-compatible with SQLite).
- **Web app**: runs locally or in the desktop app, connects to the remote daemon.

## Prerequisites

- Docker installed locally (for building/testing the image)
- A [Railway](https://railway.app) or [Fly.io](https://fly.io) account
- A [Turso](https://turso.tech) account for cloud database
- Your OANDA API credentials (account ID + API token)

## Turso Database Setup

1. **Install the Turso CLI**:

   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   turso auth login
   ```

2. **Create a database**:

   ```bash
   turso db create fxflow
   ```

3. **Get the connection URL**:

   ```bash
   turso db show fxflow --url
   ```

   This returns a URL like `libsql://fxflow-yourname.turso.io`.

4. **Create an auth token**:

   ```bash
   turso db tokens create fxflow
   ```

   Save this token — you will need it for the daemon environment variables.

5. **Apply migrations** (from the project root):
   ```bash
   DATABASE_URL="libsql://fxflow-yourname.turso.io" \
   TURSO_AUTH_TOKEN="your-token" \
   pnpm --filter @fxflow/db db:push
   ```

## Railway Deployment

### Step 1: Create the Service

1. Log in to [Railway](https://railway.app) and create a new project.
2. Choose **Deploy from GitHub repo** and select your FXFlow repository.
3. Railway will detect the `Dockerfile` automatically.

### Step 2: Configure the Build

The project includes a `railway.toml` at `apps/daemons/railway.toml`:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "apps/daemons/Dockerfile"

[deploy]
healthcheckPath = "/health/ready"
healthcheckTimeout = 10
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5
```

> [!NOTE]
> Railway uses the Dockerfile at `apps/daemons/Dockerfile`. The build context is the monorepo root, so workspace dependencies (`packages/*`) are included.

### Step 3: Set Environment Variables

In Railway's service settings, add these variables:

| Variable           | Value                               | Description                     |
| ------------------ | ----------------------------------- | ------------------------------- |
| `DATABASE_URL`     | `libsql://fxflow-yourname.turso.io` | Turso database URL              |
| `TURSO_AUTH_TOKEN` | `your-token`                        | Turso auth token                |
| `OANDA_ACCOUNT_ID` | `xxx-xxx-xxxxxxx-xxx`               | Your OANDA account ID           |
| `OANDA_API_TOKEN`  | `your-oanda-token`                  | Your OANDA API key              |
| `OANDA_BASE_URL`   | `https://api-fxpractice.oanda.com`  | Practice or live URL            |
| `ENCRYPTION_KEY`   | `your-32-char-key`                  | For encrypted credentials in DB |
| `NODE_ENV`         | `production`                        | Production mode                 |

> [!TIP]
> Railway automatically sets `PORT` — the daemon reads it via `config.ts` fallback chain: `DAEMON_PORT ?? PORT ?? "4100"`.

### Step 4: Deploy

Push to your main branch or trigger a manual deploy in Railway. The build takes 2-3 minutes. Railway will run the health check at `/health/ready` and mark the service as live once the daemon is initialized.

## Fly.io Deployment

### Step 1: Create a `fly.toml`

Create `fly.toml` in the project root (or use `fly launch`):

```toml
app = "fxflow-daemon"
primary_region = "lhr"  # Choose your nearest region

[build]
  dockerfile = "apps/daemons/Dockerfile"

[env]
  NODE_ENV = "production"

[http_service]
  internal_port = 4100
  force_https = true

  [http_service.concurrency]
    type = "connections"
    hard_limit = 100
    soft_limit = 50

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  timeout = "5s"
  path = "/health/ready"
```

### Step 2: Set Secrets

```bash
fly secrets set \
  DATABASE_URL="libsql://fxflow-yourname.turso.io" \
  TURSO_AUTH_TOKEN="your-token" \
  OANDA_ACCOUNT_ID="xxx-xxx-xxxxxxx-xxx" \
  OANDA_API_TOKEN="your-oanda-token" \
  OANDA_BASE_URL="https://api-fxpractice.oanda.com" \
  ENCRYPTION_KEY="your-32-char-key"
```

### Step 3: Deploy

```bash
fly deploy
```

## Connecting the Web App

Once the daemon is deployed, configure the web app to connect to it:

1. Open FXFlow (local dev or desktop app).
2. Go to **Settings > Deployment**.
3. Change **Deployment Mode** to **Cloud**.
4. Enter the **Cloud Daemon URL** — the public URL from Railway or Fly.io (e.g., `https://fxflow-daemon.up.railway.app`).
5. Optionally enter the **Cloud Database URL** and **Turso Auth Token** if the web app also needs direct DB access.
6. Save. The web app will reconnect to the remote daemon.

> [!NOTE]
> In cloud mode, the desktop app does NOT spawn a local daemon. It connects to the remote daemon URL for both REST and WebSocket communication.

## Health Monitoring

The daemon exposes three health endpoints:

### `GET /health` — Liveness

Always returns `200` with uptime. Use this for basic "is the process alive?" checks.

```json
{ "ok": true, "uptime": 3600.5 }
```

### `GET /health/ready` — Readiness

Returns `200` when fully initialized (OANDA connected, DB ready). Returns `503` during startup. Use this for deployment health checks — Railway and Fly.io both use this endpoint.

```json
{ "ok": true, "uptime": 3600.5 }
```

### `GET /health/detailed` — Detailed Status

Returns comprehensive status including memory usage, connected WebSocket clients, OANDA connection state, market status, and subsystem states.

```json
{
  "ok": true,
  "data": {
    "uptimeSeconds": 3600,
    "startedAt": "2025-01-15T10:00:00Z",
    "memory": { "rss": 85000000, "heapUsed": 45000000 },
    "wsClients": 2,
    "oanda": { "status": "connected" },
    "market": { "isOpen": true },
    "tradingMode": "practice",
    "tvAlerts": { "enabled": true },
    "tradeFinder": { "enabled": true },
    "aiTrader": { "enabled": false }
  }
}
```

## Docker (Local Testing)

You can build and test the Docker image locally before deploying:

```bash
# Build from monorepo root
docker build -f apps/daemons/Dockerfile -t fxflow-daemon .

# Run with environment variables
docker run -p 4100:4100 \
  -e DATABASE_URL="file:./data/fxflow.db" \
  -e OANDA_ACCOUNT_ID="your-id" \
  -e OANDA_API_TOKEN="your-token" \
  -e OANDA_BASE_URL="https://api-fxpractice.oanda.com" \
  fxflow-daemon
```

The Dockerfile uses a multi-stage build:

1. **Builder stage**: installs pnpm, copies workspace files, installs dependencies, generates Prisma client.
2. **Runner stage**: copies the full build, prunes dev dependencies, runs the daemon via `node --import tsx`.

The built-in `HEALTHCHECK` instruction pings `/health/ready` every 30 seconds.

## Gotchas

- The daemon uses `config.ts` to resolve ports: `DAEMON_PORT ?? PORT ?? "4100"`. Railway/Fly.io set `PORT` automatically — do not hardcode a port.
- WebSocket connections from the web app need the daemon URL to be accessible over the public internet. Railway and Fly.io handle HTTPS/WSS termination.
- The Turso connection uses `@prisma/adapter-libsql` — this is handled automatically in `packages/db/src/client.ts` when `DATABASE_URL` starts with `libsql://`.
- OANDA API credentials are stored encrypted in the database, but also need to be set as environment variables for the daemon to use on first startup before the DB is populated.
- The daemon's transaction stream and pricing stream maintain persistent SSE connections to OANDA. Make sure your deployment platform does not kill long-lived connections.
