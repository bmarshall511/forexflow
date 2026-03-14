# Remote Access & Security

## Overview

FXFlow supports secure remote access from phones and other devices via Cloudflare Tunnel. Zero configuration required — `pnpm dev` handles everything automatically.

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

## Key Files

| File                                                              | Purpose                                       |
| ----------------------------------------------------------------- | --------------------------------------------- |
| `packages/db/src/auth-service.ts`                                 | PIN hashing, verification, session management |
| `apps/web/src/middleware.ts`                                      | Auth guard for all routes                     |
| `apps/web/src/app/(auth)/login/page.tsx`                          | PIN login page                                |
| `apps/web/src/app/(auth)/setup/page.tsx`                          | First-time PIN setup                          |
| `apps/web/src/components/auth/pin-pad.tsx`                        | Reusable PIN keypad                           |
| `apps/web/src/components/auth/pin-dots.tsx`                       | PIN progress indicator                        |
| `apps/web/src/components/auth/lockout-timer.tsx`                  | Lockout countdown                             |
| `apps/web/src/app/api/auth/*/route.ts`                            | Auth API routes (7 routes)                    |
| `apps/web/src/lib/rate-limit.ts`                                  | In-memory rate limiter                        |
| `apps/web/server.ts`                                              | Custom server with WS proxy (production)      |
| `apps/web/src/hooks/use-daemon-connection.ts`                     | WS + REST polling fallback                    |
| `apps/web/src/app/api/daemon/[...path]/route.ts`                  | Daemon REST proxy                             |
| `apps/web/src/app/api/settings/tunnel-status/route.ts`            | Tunnel status + URL API                       |
| `apps/web/src/components/layout/remote-access-status-popover.tsx` | Header tunnel status                          |
| `apps/web/src/components/settings/security-*.tsx`                 | Security settings UI                          |
| `apps/web/public/manifest.json`                                   | PWA manifest                                  |
| `apps/web/public/sw.js`                                           | Service worker                                |
| `scripts/dev.sh`                                                  | Dev environment with auto-tunnel              |
| `cloudflare/tunnel-config.example.yml`                            | Named tunnel config template                  |
