/**
 * Electron main process entry point.
 *
 * Orchestrates:
 * 1. App lifecycle (single instance, dock hide on close, quit on all windows closed)
 * 2. Daemon child process (local mode) or remote connection (cloud mode)
 * 3. Next.js web server (embedded)
 * 4. System tray icon with status
 * 5. Auto-updater via GitHub Releases
 * 6. IPC bridge for renderer queries
 *
 * @module index
 */
import { app, BrowserWindow } from "electron"
import path from "node:path"
import { fork, type ChildProcess } from "node:child_process"
import { store } from "./store"
import { createMainWindow } from "./window"
import { TrayManager } from "./tray"
import { DaemonManager } from "./daemon-manager"
import { setupAutoUpdater } from "./updater"
import { registerIpcHandlers } from "./ipc-handlers"

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let webServerProcess: ChildProcess | null = null
const trayManager = new TrayManager()
let daemonManager: DaemonManager | null = null

/**
 * Start the embedded Next.js web server.
 * In local mode, this serves the UI on localhost:3000.
 */
function startWebServer(env: Record<string, string>): void {
  const serverEntry = app.isPackaged
    ? path.join(process.resourcesPath, "web", "server.js")
    : path.join(app.getAppPath(), "..", "..", "web", "dist", "server.js")

  webServerProcess = fork(serverEntry, [], {
    env: {
      ...process.env,
      ...env,
      PORT: "3000",
      NODE_ENV: "production",
      FXFLOW_ELECTRON: "1",
    } as Record<string, string>,
    stdio: ["pipe", "pipe", "pipe", "ipc"],
    silent: true,
  })

  webServerProcess.stdout?.on("data", (data: Buffer) => {
    console.log(`[web] ${data.toString().trim()}`)
  })

  webServerProcess.stderr?.on("data", (data: Buffer) => {
    console.error(`[web] ${data.toString().trim()}`)
  })

  webServerProcess.on("exit", (code) => {
    console.log(`[web] Server exited with code ${code}`)
    webServerProcess = null
  })
}

/** Build environment variables for child processes. */
function buildChildEnv(): Record<string, string> {
  const mode = store.get("deploymentMode")
  const dataDir = path.join(app.getPath("userData"), "data")
  const encryptionKey = process.env.ENCRYPTION_KEY || ""

  const env: Record<string, string> = {
    FXFLOW_MODE: mode,
    FXFLOW_ELECTRON: "1",
    ENCRYPTION_KEY: encryptionKey,
  }

  if (mode === "cloud") {
    env.DAEMON_URL = store.get("cloudDaemonUrl")
    env.DAEMON_WS_URL = store.get("cloudDaemonUrl").replace(/^http/, "ws")
    env.DATABASE_URL = store.get("cloudDatabaseUrl") || `file:${path.join(dataDir, "fxflow.db")}`
    if (store.get("cloudTursoToken")) {
      env.TURSO_AUTH_TOKEN = store.get("cloudTursoToken")
    }
  } else {
    env.DATABASE_URL = `file:${path.join(dataDir, "fxflow.db")}`
    env.DAEMON_URL = "http://localhost:4100"
    env.DAEMON_WS_URL = "ws://localhost:4100"
  }

  return env
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

app.whenReady().then(async () => {
  const mode = store.get("deploymentMode")
  const env = buildChildEnv()

  // Ensure data directory exists (local mode)
  if (mode === "local") {
    const dataDir = path.join(app.getPath("userData"), "data")
    const { mkdirSync } = await import("node:fs")
    mkdirSync(dataDir, { recursive: true })
  }

  // Start daemon in local mode
  if (mode === "local") {
    daemonManager = new DaemonManager((running) => {
      if (mainWindow) {
        trayManager.setDaemonStatus(running, mainWindow)
      }
    })
    daemonManager.start(env)
  }

  // Start embedded web server
  startWebServer(env)

  // Wait for web server to be ready
  await waitForServer("http://localhost:3000", 30_000)

  // Create window
  mainWindow = createMainWindow()

  // System tray
  trayManager.create(mainWindow)
  if (daemonManager) {
    trayManager.setDaemonStatus(daemonManager.isRunning, mainWindow)
  }

  // IPC handlers
  registerIpcHandlers(daemonManager)

  // Auto-updater
  setupAutoUpdater(mainWindow)

  // Auto-launch setting
  const autoLaunch = store.get("autoLaunch")
  app.setLoginItemSettings({ openAtLogin: autoLaunch })

  // Hide to tray on window close (don't quit)
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
})

// macOS: re-create window when dock icon is clicked
app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
  }
})

// Quit handler — clean up child processes
app.on("before-quit", async () => {
  ;(app as { isQuitting?: boolean }).isQuitting = true

  trayManager.destroy()

  if (daemonManager) {
    await daemonManager.stop()
  }

  if (webServerProcess) {
    webServerProcess.kill("SIGTERM")
    webServerProcess = null
  }
})

// Keep app running when all windows are closed (tray mode)
app.on("window-all-closed", () => {
  // Don't quit — daemon keeps running in tray
})

/** Poll a URL until it responds or timeout. */
async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  console.warn(`[startup] Server at ${url} did not respond within ${timeoutMs}ms`)
}
