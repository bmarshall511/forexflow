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
  template.db             # Pre-migrated empty SQLite DB (build artifact, gitignored)
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

- `pnpm desktop:dist` (from repo root) — single command to build everything and package the arm64 DMG locally.
- `pnpm electron:build` — compile main/preload via `tsc` (not electron-vite).
- `pnpm electron:package` — build macOS DMG via electron-builder. In CI, `--publish never` is passed to prevent electron-builder from auto-publishing (uploads handled separately via `gh release upload`).
- DMG is **unsigned** (no Apple Developer account) — users right-click → Open on first launch.
- `electron-builder.yml` bundles web + daemon as `extraResources`. Custom app icon at `assets/icon.icns`.
- Since the app is unsigned, macOS Gatekeeper may show "damaged" error on first launch. Users must run `xattr -cr /path/to/FXFlow.app` to remove the quarantine attribute.
- GitHub Actions builds arm64 + x64 DMGs on each release, both on `macos-latest` (ARM); x64 is cross-compiled via `--x64` flag.

### Database Initialization

- A template SQLite database (with schema applied via `prisma migrate deploy`) is created at build time.
- Bundled as `assets/template.db` (gitignored build artifact).
- On first launch, if no database exists at the data directory, the template is copied.
- This ensures Prisma queries work immediately without requiring the Prisma CLI at runtime.

### Web Server Bundling

- Next.js is configured with `output: "standalone"` and `outputFileTracingRoot` pointing to the monorepo root.
- This produces `.next/standalone/` — a self-contained directory with `server.js`, traced `node_modules`, and workspace packages.
- Static files (`.next/static`) and `public/` are copied alongside the standalone output during the build.
- `outputFileTracingIncludes` explicitly adds `@libsql/darwin-arm64` and `@libsql/darwin-x64` native binaries (pnpm's dynamic require can't be auto-traced).
- `scripts/fix-standalone-native.sh` runs post-build to fix pnpm native module resolution (copies native modules into the correct `node_modules` path for runtime resolution).
- In the packaged app, the server entry is at `resources/web-standalone/apps/web/server.js`.

### Daemon Bundling

- `pnpm deploy --legacy` creates a self-contained copy of the daemon with all dependencies resolved (no pnpm symlinks).
- Output goes to `apps/desktop/daemon-bundle/` (gitignored build artifact).
- The daemon runs TypeScript directly via `node --import tsx/esm` (same approach as the Docker container).
- `tsx` is a production dependency of `@fxflow/daemons` (not dev-only) since it's the runtime loader.
- In the packaged app, the daemon entry is at `resources/daemon-bundle/src/index.ts`.

## Gotchas

- Desktop app is excluded from turbo `dev`/`build`/`typecheck`/`lint` tasks.
- `node_modules` must be installed separately: `cd apps/desktop && pnpm install`.
- The web app is served on localhost by a forked Next.js standalone server, then loaded in BrowserWindow.
- `waitForServer()` polls localhost:3000 before showing the window.
- Tray icon must be a template image for macOS dark/light mode support.
- `daemon-bundle/` and `assets/template.db` are build artifacts (gitignored) — do not commit them.
- iCloud Drive can cause issues with `pnpm deploy` due to permission errors. The `desktop:dist` script works around this by deploying to `/tmp` first, then copying back.
- DevTools can be opened in the packaged app with Cmd+Shift+I for debugging.
- Renderer console messages are forwarded to main process stdout for debugging.
