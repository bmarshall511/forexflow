# apps/desktop — Electron macOS Desktop App

## Architecture

- Electron app that wraps the Next.js web app + daemon for non-technical users.
- Main process manages: BrowserWindow, system tray, daemon child process, IPC, auto-updater.
- **Not part of the standard turbo pipeline** — uses `electron:*` scripts instead.
- Imported as `@fxflow/desktop`. May import from `packages/*` but never from other `apps/*`.

## Directory Structure

```
src/
  main/
    index.ts              # Main orchestrator (single instance, startup sequence)
    daemon-manager.ts     # Daemon child process (fork, auto-restart, graceful shutdown)
    window.ts             # BrowserWindow (hiddenInset titlebar, persisted bounds)
    tray.ts               # System tray (template icon, context menu, click-to-toggle)
    updater.ts            # Auto-updater (GitHub Releases, 4-hour check interval)
    ipc-handlers.ts       # IPC handlers (version, deployment mode, daemon status)
    store.ts              # Persistent settings (electron-store)
  preload/
    index.ts              # contextBridge → window.fxflow API
assets/
  icon.icns               # macOS app icon (generated from PWA icon-512.png)
  tray-icon.png           # macOS template tray icon
electron-builder.yml      # Build config (DMG, unsigned, GitHub publish)
```

## Key Patterns

### Daemon Management

- Daemon spawned via `fork()` in local mode. NOT spawned in cloud mode.
- Auto-restart with exponential backoff (max 5 restarts).
- Graceful SIGTERM shutdown with 5-second timeout before SIGKILL.
- stdout/stderr captured and logged.

### Window Behavior

- Close → hide to tray (daemon keeps running). Quit via tray menu or Cmd+Q.
- Window bounds persisted in electron-store, restored on next launch.
- External links (target=\_blank) open in default browser, not in-app.
- Dark background matches the app theme.

### IPC Bridge

`contextBridge` exposes `window.fxflow` API to the renderer:

- `getVersion()` — app version from package.json
- `getDeploymentMode()` / `setDeploymentMode()` — local or cloud
- `getCloudDaemonUrl()` / `setCloudDaemonUrl()` — remote daemon URL
- `getDaemonStatus()` — child process running state
- `getAutoLaunch()` / `setAutoLaunch()` — login item toggle

### Auto-Updater

- `electron-updater` checks GitHub Releases every 4 hours.
- Shows dialog on available update; user confirms restart to install.
- Published via `.github/workflows/desktop.yml`.

## Build & Distribution

- `pnpm electron:build` — compile main/preload via `tsc` (not electron-vite).
- `pnpm electron:package` — build macOS DMG via electron-builder. In CI, `--publish never` is passed to prevent electron-builder from auto-publishing (uploads handled separately via `gh release upload`).
- DMG is **unsigned** (no Apple Developer account) — users right-click → Open on first launch.
- `electron-builder.yml` bundles daemon + web app as `extraResources`. Custom app icon at `assets/icon.icns`.
- Since the app is unsigned, macOS Gatekeeper may show "damaged" error on first launch. Users must run `xattr -cr /path/to/FXFlow.app` to remove the quarantine attribute.
- GitHub Actions builds arm64 + x64 DMGs on each release, both on `macos-latest` (ARM); x64 is cross-compiled via `--x64` flag.

## Gotchas

- Desktop app is excluded from turbo `dev`/`build`/`typecheck`/`lint` tasks.
- `node_modules` must be installed separately: `cd apps/desktop && pnpm install`.
- The web app is served on localhost by a forked Next.js server process, then loaded in BrowserWindow.
- `waitForServer()` polls localhost:3000 before showing the window.
- Tray icon must be a template image for macOS dark/light mode support.
