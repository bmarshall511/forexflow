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
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs"
import { fork, type ChildProcess } from "node:child_process"
import { store } from "./store.js"
import { createMainWindow } from "./window.js"
import { createSplashWindow } from "./splash.js"
import { TrayManager } from "./tray.js"
import { DaemonManager } from "./daemon-manager.js"
import { setupAutoUpdater } from "./updater.js"
import { registerIpcHandlers } from "./ipc-handlers.js"

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let webServerProcess: ChildProcess | null = null
const trayManager = new TrayManager()
let daemonManager: DaemonManager | null = null
let isQuitting = false

/**
 * Start the embedded Next.js web server.
 * Uses the Next.js standalone output (server.js) which is a self-contained server.
 * The cwd must be set to the server directory so Next.js can find its .next folder.
 */
function startWebServer(env: Record<string, string>): void {
  const serverDir = app.isPackaged
    ? path.join(process.resourcesPath, "web-standalone", "apps", "web")
    : path.join(app.getAppPath(), "..", "..", "web", ".next", "standalone", "apps", "web")
  const serverEntry = path.join(serverDir, "server.js")

  // Startup diagnostics — verify critical files exist
  console.log(`[startup] isPackaged: ${app.isPackaged}`)
  console.log(`[startup] serverDir: ${serverDir}`)
  console.log(`[startup] server.js exists: ${existsSync(serverEntry)}`)
  const staticDir = path.join(serverDir, ".next", "static")
  console.log(`[startup] .next/static exists: ${existsSync(staticDir)}`)
  if (existsSync(staticDir)) {
    try {
      console.log(`[startup] .next/static contents: ${readdirSync(staticDir).join(", ")}`)
    } catch {
      /* ignore */
    }
  }
  const publicDir = path.join(serverDir, "public")
  console.log(`[startup] public/ exists: ${existsSync(publicDir)}`)

  webServerProcess = fork(serverEntry, [], {
    cwd: serverDir,
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

  // Show splash screen immediately so user sees the app is loading
  const splash = createSplashWindow()

  // Ensure data directory and database exist (local mode)
  if (mode === "local") {
    const dataDir = path.join(app.getPath("userData"), "data")
    mkdirSync(dataDir, { recursive: true })

    // On first launch, copy the template database with schema already applied.
    // Without this, Prisma queries fail with "no such table" errors.
    const dbPath = path.join(dataDir, "fxflow.db")
    if (!existsSync(dbPath)) {
      const templatePath = app.isPackaged
        ? path.join(process.resourcesPath, "template.db")
        : path.join(app.getAppPath(), "assets", "template.db")
      if (existsSync(templatePath)) {
        copyFileSync(templatePath, dbPath)
        console.log("[startup] Initialized database from template")
      } else {
        console.warn("[startup] No template database found — database may need manual migration")
      }
    }
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

  // Create main window and close splash
  mainWindow = createMainWindow()
  mainWindow.once("ready-to-show", () => {
    splash.close()
  })

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
    if (!isQuitting) {
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
  isQuitting = true

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
      const res = await fetch(url, { redirect: "manual" })
      if (res.status < 500) return
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  console.warn(`[startup] Server at ${url} did not respond within ${timeoutMs}ms`)
}
