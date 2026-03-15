---
paths:
  - "apps/desktop/**"
---

# Electron Desktop App Conventions

- Main process code in `src/main/`. Preload in `src/preload/`.
- IPC via `contextBridge` only. Never expose `ipcRenderer` directly.
- Daemon spawned as `fork()` child process in local mode. Not spawned in cloud mode.
- Window close hides to tray. Quit via tray menu or Cmd+Q.
- Auto-updater checks GitHub Releases every 4 hours.
- Desktop app is excluded from turbo pipeline. Uses `electron:*` scripts.
- Never import from other `apps/*`. Only import from `packages/*`.
- Unsigned builds: users right-click → Open → Open Anyway on first launch.
