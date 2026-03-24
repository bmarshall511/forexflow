---
title: "Desktop App"
description: "Install and run FXFlow as a native macOS desktop application."
category: "getting-started"
order: 6
---

# Desktop App

## What Is the Desktop App?

The FXFlow desktop app is a native macOS application that bundles everything you need into a single download. Instead of running terminal commands or managing a development environment, you just open an app — like any other program on your Mac.

Under the hood, it runs the same FXFlow web interface and the same daemon (the engine that talks to OANDA), but packaged together so you never have to think about it.

## Installation

### Download

1. Go to the [FXFlow GitHub Releases](https://github.com) page (your project maintainer will share the exact URL).
2. Download the `.dmg` file for your Mac:
   - **Apple Silicon** (M1/M2/M3/M4): download the `arm64` DMG
   - **Intel Macs**: download the `x64` DMG
3. Open the DMG and drag FXFlow to your Applications folder.

### First Launch (Gatekeeper Bypass)

Because FXFlow is not signed with an Apple Developer certificate, macOS will block it the first time you try to open it. This is normal for open-source apps distributed outside the App Store.

**Option A — Right-click to open:**

1. Right-click (or Control-click) on FXFlow in your Applications folder.
2. Click **Open** from the context menu.
3. In the dialog that appears, click **Open** again.

**Option B — If macOS says the app is "damaged":**

Open Terminal and run:

```bash
xattr -cr /Applications/FXFlow.app
```

Then try opening the app again.

> [!NOTE]
> You only need to do this once. After the first launch, macOS will remember your choice and open FXFlow normally.

## First Launch Experience

When FXFlow starts for the first time:

1. A **splash screen** appears while the app loads its internal services.
2. The embedded web server and daemon start automatically in the background.
3. After a few seconds, the main FXFlow window opens.
4. You will see the **onboarding wizard** — follow it to connect your OANDA account.

The app runs in **local mode** by default, meaning everything runs on your Mac. Your database is stored in the app's data directory, and the daemon runs as a background process.

## Local Mode vs Cloud Mode

FXFlow supports two deployment modes:

| Feature       | Local Mode                      | Cloud Mode                               |
| ------------- | ------------------------------- | ---------------------------------------- |
| **Daemon**    | Runs on your Mac (auto-managed) | Runs on a remote server (Railway/Fly.io) |
| **Database**  | SQLite file on your Mac         | Turso cloud database                     |
| **Always on** | Only while the app is open      | 24/7, even when your Mac is off          |
| **Setup**     | Zero configuration              | Requires server deployment               |

Most users should start with local mode. Switch to cloud mode if you need the daemon running 24/7 for automated trading while your Mac is closed.

To change modes, go to **Settings > Deployment** in the app.

## System Tray

When you close the FXFlow window (click the red X), the app does not quit. Instead, it hides to the **system tray** (the menu bar at the top of your screen). The daemon keeps running in the background so your trades and signals continue to be monitored.

The tray icon shows a context menu with:

- **Show FXFlow** — bring the window back
- **Daemon: Running / Stopped** — current daemon status
- **Quit FXFlow** — fully stop the app and daemon

You can also click the tray icon to toggle the window visibility.

> [!TIP]
> To fully quit FXFlow, use the tray menu "Quit FXFlow" or press **Cmd+Q**. Simply closing the window only hides it.

## Auto-Updater

FXFlow checks for updates automatically:

- **On launch** — after a short delay to let the app settle.
- **Every 4 hours** — while the app is running.

When an update is available, it downloads in the background. Once ready, a dialog asks if you want to restart now or later. Choosing "Restart Now" installs the update and relaunches the app.

Updates are published to GitHub Releases by the project maintainer.

## Keyboard Shortcuts

| Shortcut        | Action                               |
| --------------- | ------------------------------------ |
| **Cmd+Q**       | Quit FXFlow (stops daemon)           |
| **Cmd+Shift+I** | Open Developer Tools (for debugging) |

## Troubleshooting

### Debug Log

The desktop app writes a debug log to:

```
/tmp/fxflow-debug.log
```

This file is recreated each time the app starts and includes timestamps for every major event: startup, daemon status, web server readiness, window creation, and any errors.

To view it, open Terminal and run:

```bash
cat /tmp/fxflow-debug.log
```

### Port Conflicts

The desktop app uses two ports:

- **Port 3456** — embedded web server (the UI you see)
- **Port 4200** — embedded daemon (background engine)

These are different from the development ports (3000 and 4100) so you can run both the desktop app and `pnpm dev` at the same time.

If another application is using these ports, FXFlow will fail to start. Check the debug log for errors and close any conflicting applications.

### Daemon Not Starting

If the tray shows "Daemon: Stopped":

1. Check `/tmp/fxflow-debug.log` for error messages.
2. Make sure you are in **local mode** (Settings > Deployment). In cloud mode, the daemon is not started locally.
3. The daemon auto-restarts up to 5 times with exponential backoff. If it exceeds this limit, restart the app.

### Database Issues

On first launch, FXFlow creates an empty database from a built-in template. If you see "no such table" errors:

1. Quit the app completely (Cmd+Q).
2. Delete the database file at `~/Library/Application Support/FXFlow/data/fxflow.db`.
3. Relaunch — FXFlow will recreate the database from the template.

> [!WARNING]
> Deleting the database removes all your local data (trade history, settings, signals). Only do this as a last resort. Your actual trades are safe on OANDA — they will re-sync when you reconnect.
