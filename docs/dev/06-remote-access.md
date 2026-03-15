---
title: "Remote Access & Deployment"
description: "Cloudflare Tunnel setup, cloud deployment, desktop app architecture, and security hardening"
category: "dev"
order: 6
---

# Remote Access, Cloud Deployment & Security

## Overview

FXFlow supports three deployment modes:

1. **Local + Tunnel** (default dev) — daemon + web on your machine, Cloudflare Tunnel for mobile access
2. **Desktop app** (Electron) — macOS DMG for non-technical users, daemon as child process
3. **Cloud mode** — daemon on Railway/Fly.io, DB on Turso, web app connects to remote daemon

For local mode, FXFlow supports secure remote access from phones and other devices via Cloudflare Tunnel. Zero configuration required — `pnpm dev` handles everything automatically.

**Security layers:**

1. **PIN Authentication** — app-level 6-digit PIN with lockout protection
2. **HTTPS Encryption** — via Cloudflare tunnel (TLS termination at edge)
3. **Unguessable URL** — random `*.trycloudflare.com` subdomain on each restart
4. **Security Headers + CORS** — defense in depth

## Architecture

```
Phone/Remote Device
  ↓ HTTPS
Cloudflare Edge (*.trycloudflare.com)
  ↓ encrypted tunnel
cloudflared (running on your machine)
  ↓ localhost:3000
Next.js (dev or custom server)
  ├── HTTP requests → Next.js pages + API routes
  ├── /api/daemon/* → REST proxy to daemon:4100
  └── /ws (WebSocket upgrade, production only) → proxy to daemon:4100
```

Single entry point: only port 3000 is exposed. The daemon on port 4100 is never directly accessible from outside.

## Quick Start

```bash
pnpm dev
```

That's it. The dev script:

1. Checks if `cloudflared` is installed (offers to install via Homebrew if not)
2. Starts a Cloudflare Quick Tunnel — no account, no domain, no login needed
3. Prints the remote URL in the terminal
4. Writes the URL to `data/.tunnel-url` so the web app can display it
5. Shows the URL in Settings > Security and the header System Health popover
6. Cleans up the tunnel and URL file on exit

Use `pnpm dev:local` to skip the tunnel entirely.

### Named Tunnels (Advanced)

For a persistent URL that doesn't change on restart, set up a named tunnel:

```bash
brew install cloudflare/cloudflare/cloudflared
cloudflared tunnel login
cloudflared tunnel create fxflow
# Edit ~/.cloudflared/config.yml (see cloudflare/tunnel-config.example.yml)
```

If `~/.cloudflared/config.yml` exists, `pnpm dev` uses the named tunnel instead of a quick tunnel.

## PIN Authentication System

### Database Models

- `AuthPin` — stores the bcrypt-hashed PIN, failed attempt count, lockout state, session expiry setting
- `AuthSession` — session tokens with expiry and device info

### Flow

1. **First visit (no PIN)** → redirected to `/setup`
   - Welcome screen → create 6-digit PIN → confirm → auto-login
2. **Returning visit** → redirected to `/login`
   - PIN pad → verify → redirect to intended page
3. **Failed attempts** → lockout
   - 5 failures → 5-minute lockout
   - 10 failures → 30-minute lockout

### Session Management

- HTTP-only secure cookie (`fxflow_session`)
- Configurable expiry: 1h, 8h, 24h, 7d, 30d (Settings > Security)
- Active sessions list with device info and revoke button
- "Log out all devices" button

### Middleware

`apps/web/src/middleware.ts` runs on all routes except public paths:

- `/api/auth/*`, `/_next/*`, `/manifest.json`, `/sw.js`, `/icons/*`

**Important:** The middleware fetches `http://localhost:${PORT}/api/auth/status` internally (not the request origin) to avoid failures when the request arrives via an external tunnel URL.

### Rate Limiting

- In-memory sliding window rate limiter (`apps/web/src/lib/rate-limit.ts`)
- Login: 5 attempts per minute per IP
- No external dependencies (suitable for single-instance)

## WebSocket Proxy

### Problem

The browser connects to the daemon on `ws://localhost:4100` directly. Remotely, this is unreachable.

### Solution: Production

A custom Next.js server (`apps/web/server.ts`) handles WebSocket upgrades on `/ws` and proxies them to the daemon:

```
Browser → wss://your-url/ws → server.ts → ws://localhost:4100
```

### Solution: Dev Mode

In dev mode (`next dev`), WebSocket proxying isn't available. Instead, `use-daemon-connection.ts` falls back to REST polling every 5 seconds via `/api/daemon/*`, keeping the UI updated with daemon status.

### Auto-Detection

`use-daemon-connection.ts` auto-detects the environment:

- **Local** (`localhost`): connects directly to `ws://localhost:4100`
- **Remote** (any other hostname): attempts `wss://${host}/ws`, falls back to REST polling

REST calls use the same pattern: local → direct to daemon, remote → `/api/daemon/*` proxy route.

The `isReachable` state tracks REST-based daemon connectivity, used alongside `isConnected` (WebSocket) so the UI reflects the daemon status regardless of connection method.

## Security Hardening

### CORS (Daemon)

- `ALLOWED_ORIGINS` env var (comma-separated)
- Default: `http://localhost:3000`
- Production: set to your tunnel URL

### Security Headers (Next.js)

Applied to all routes via `next.config.ts`:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-XSS-Protection: 1; mode=block`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## PWA Support

### Manifest

`public/manifest.json` — app name, icons, standalone display mode, dark theme.

### Service Worker

`public/sw.js` — minimal, network-first strategy. Caches offline fallback only. Trading data must always be live.

### Installation

On mobile: "Add to Home Screen" in Safari/Chrome. The app launches fullscreen without browser chrome.

## Tunnel URL Display

The tunnel URL is available in the app for easy sharing:

- **Terminal** — printed when `pnpm dev` starts
- **Header** — System Health popover → Remote Access → shows URL with copy button
- **Settings** — Settings > Security → Remote Access card with copy button

### How It Works

1. `scripts/dev.sh` writes the URL to `data/.tunnel-url`
2. `/api/settings/tunnel-status` reads the file and returns `{ installed, running, url }`
3. UI components fetch the status and display the URL with copy-to-clipboard

The URL file is cleaned up on exit and is gitignored (inside `data/`).

## Cloud Deployment Mode

### Overview

Cloud mode runs the daemon on a remote server (Railway, Fly.io) with the database on Turso (cloud LibSQL). The web app connects directly to the remote daemon instead of localhost.

### Architecture

```
Phone/Desktop Browser
  ↓ HTTPS
Cloud Daemon (Railway/Fly.io)
  ├── REST API (trade actions, status)
  ├── WebSocket (real-time updates)
  └── Turso DB (cloud LibSQL)
        ↑
OANDA API (streaming + REST)
```

### Configuration

1. **Deploy daemon**: Use the included `apps/daemons/Dockerfile` + `railway.toml`
2. **Set env vars** on the cloud host:
   - `DATABASE_URL=libsql://your-db.turso.io`
   - `TURSO_AUTH_TOKEN=your-token`
   - `ENCRYPTION_KEY=your-64-char-hex`
   - `PORT` (auto-set by Railway/Fly.io)
3. **Configure web app**: Set `NEXT_PUBLIC_CLOUD_DAEMON_URL=https://your-daemon.railway.app`
4. **Or via Settings**: Settings > Deployment > Cloud mode > enter daemon URL

### DB Client (Local vs Cloud)

`packages/db/src/client.ts` auto-detects the connection mode:

- **Local** (`file:` URL): SQLite with WAL mode + busy_timeout pragmas
- **Remote** (`libsql://` or `https://`): Turso with auth token, no SQLite pragmas

### Health Endpoints

- `GET /health` — liveness probe (always returns 200)
- `GET /health/ready` — readiness probe (checks OANDA connection + DB access)

## Desktop App (Electron)

### Overview

The Electron app packages the web app + daemon into a macOS DMG for non-technical users. No Node.js, pnpm, or terminal knowledge required.

### Architecture

- **Main process**: manages BrowserWindow, system tray, daemon child process, auto-updater
- **Daemon**: spawned as `fork()` child process in local mode, auto-restarts with exponential backoff (max 5 restarts)
- **Web app**: Next.js standalone output (`output: "standalone"`) served on localhost, loaded in BrowserWindow
- **System tray**: close → hide to tray (daemon keeps running), context menu for status/quit
- **Auto-updater**: `electron-updater` checks GitHub Releases every 4 hours

### Build & Distribution

- `pnpm desktop:dist` (from repo root) — single command to build everything and package the arm64 DMG locally
- `electron:build` compiles main/preload via `tsc` (not electron-vite; `electron-vite` and `vite` are not dependencies)
- Packaged via `electron-builder` (DMG for macOS arm64 + x64)
- **Unsigned** — macOS Gatekeeper may show "damaged" error on first launch. Fix: `xattr -cr /path/to/FXFlow.app`
- Custom app icon at `assets/icon.icns` (generated from the PWA `icon-512.png`)
- Published to GitHub Releases via `.github/workflows/desktop.yml`

### IPC Bridge

`contextBridge` exposes `window.fxflow` API to the renderer:

- `getVersion()`, `getDeploymentMode()`, `setDeploymentMode()`
- `getCloudDaemonUrl()`, `setCloudDaemonUrl()`
- `getDaemonStatus()`, `getAutoLaunch()`, `setAutoLaunch()`

### Key Files

| File                                      | Purpose                              |
| ----------------------------------------- | ------------------------------------ |
| `apps/desktop/src/main/index.ts`          | Main orchestrator                    |
| `apps/desktop/src/main/daemon-manager.ts` | Daemon child process management      |
| `apps/desktop/src/main/window.ts`         | BrowserWindow creation               |
| `apps/desktop/src/main/tray.ts`           | System tray + context menu           |
| `apps/desktop/src/main/updater.ts`        | Auto-update via GitHub Releases      |
| `apps/desktop/src/main/ipc-handlers.ts`   | IPC handler registration             |
| `apps/desktop/src/main/store.ts`          | Persistent settings (electron-store) |
| `apps/desktop/src/preload/index.ts`       | contextBridge preload                |
| `apps/desktop/electron-builder.yml`       | Build configuration                  |
| `.github/workflows/desktop.yml`           | CI: build + upload DMG to release    |
