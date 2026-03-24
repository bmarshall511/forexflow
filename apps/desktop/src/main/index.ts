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
import net from "node:net"
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from "node:fs"
import { fork, type ChildProcess } from "node:child_process"
import { store } from "./store.js"
import { createMainWindow } from "./window.js"
import { createSplashWindow } from "./splash.js"
import { TrayManager } from "./tray.js"
import { DaemonManager } from "./daemon-manager.js"
import { setupAutoUpdater } from "./updater.js"
import { registerIpcHandlers } from "./ipc-handlers.js"

// File-based debug logging (stdout is swallowed in packaged macOS apps)
const LOG_FILE = "/tmp/fxflow-debug.log"
function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  console.log(msg)
  try {
    appendFileSync(LOG_FILE, line)
  } catch {
    // ignore
  }
}
try {
  writeFileSync(LOG_FILE, `[${new Date().toISOString()}] === FXFlow starting ===\n`)
} catch {
  // ignore
}
log(`isPackaged: ${app.isPackaged}`)
log(`resourcesPath: ${process.resourcesPath}`)
log(`appPath: ${app.getAppPath()}`)
log(`userData: ${app.getPath("userData")}`)

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  log("Another instance is running — quitting")
  app.quit()
} else {
  log("Got single instance lock")
}

/** Port for the embedded web server — avoids conflict with dev server on 3000. */
let WEB_SERVER_PORT = 3456
/** Port for the desktop daemon — avoids conflict with dev daemon on 4100. */
let DAEMON_PORT = 4200

const PORT_SCAN_MAX_ATTEMPTS = 5

/** Check if a port is available by attempting to bind to it. */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once("error", () => resolve(false))
    server.once("listening", () => {
      server.close(() => resolve(true))
    })
    server.listen(port, "127.0.0.1")
  })
}

/** Find an available port starting from the given port, trying up to maxAttempts consecutive ports. */
async function findAvailablePort(startPort: number, label: string): Promise<number> {
  for (let i = 0; i < PORT_SCAN_MAX_ATTEMPTS; i++) {
    const port = startPort + i
    if (await isPortAvailable(port)) {
      if (i > 0) {
        log(`[ports] ${label} port ${startPort} was occupied, using ${port} instead`)
      }
      return port
    }
    log(`[ports] ${label} port ${port} is in use, trying next...`)
  }
  // Fall back to the original port and let the process fail with a clear error
  log(
    `[ports] WARNING: No available port found for ${label} after ${PORT_SCAN_MAX_ATTEMPTS} attempts, using ${startPort}`,
  )
  return startPort
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
  log(`[startup] serverDir: ${serverDir}`)
  log(`[startup] server.js exists: ${existsSync(serverEntry)}`)
  const staticDir = path.join(serverDir, ".next", "static")
  log(`[startup] .next/static exists: ${existsSync(staticDir)}`)
  if (existsSync(staticDir)) {
    try {
      log(`[startup] .next/static contents: ${readdirSync(staticDir).join(", ")}`)
    } catch {
      /* ignore */
    }
  }
  const publicDir = path.join(serverDir, "public")
  log(`[startup] public/ exists: ${existsSync(publicDir)}`)

  // Pass daemon URLs to the web server so both server-side API routes and
  // client-side hooks connect to the desktop daemon port (not the dev port).
  const daemonRestUrl = env.DAEMON_URL ?? `http://localhost:${DAEMON_PORT}`
  const daemonWsUrl = env.DAEMON_WS_URL ?? `ws://localhost:${DAEMON_PORT}`

  webServerProcess = fork(serverEntry, [], {
    cwd: serverDir,
    env: {
      ...process.env,
      ...env,
      PORT: String(WEB_SERVER_PORT),
      NODE_ENV: "production",
      FXFLOW_ELECTRON: "1",
      // Server-side API routes use these
      DAEMON_REST_URL: daemonRestUrl,
      // Client-side hooks use NEXT_PUBLIC_ variants (runtime override for standalone)
      NEXT_PUBLIC_DAEMON_REST_URL: daemonRestUrl,
      NEXT_PUBLIC_DAEMON_URL: daemonWsUrl,
    } as Record<string, string>,
    stdio: ["pipe", "pipe", "pipe", "ipc"],
    silent: true,
  })

  webServerProcess.stdout?.on("data", (data: Buffer) => {
    log(`[web] ${data.toString().trim()}`)
  })

  webServerProcess.stderr?.on("data", (data: Buffer) => {
    log(`[web:err] ${data.toString().trim()}`)
  })

  webServerProcess.on("exit", (code) => {
    log(`[web] Server exited with code ${code}`)
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
    env.DAEMON_PORT = String(DAEMON_PORT)
    env.DAEMON_URL = `http://localhost:${DAEMON_PORT}`
    env.DAEMON_WS_URL = `ws://localhost:${DAEMON_PORT}`
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
  log("[startup] app.whenReady fired")
  const mode = store.get("deploymentMode")
  log(`[startup] deploymentMode: ${mode}`)

  // Show splash screen immediately so user sees the app is loading
  const splash = createSplashWindow()
  log("[startup] Splash window created")

  // Resolve available ports before starting anything
  DAEMON_PORT = await findAvailablePort(DAEMON_PORT, "daemon")
  WEB_SERVER_PORT = await findAvailablePort(WEB_SERVER_PORT, "web-server")
  log(`[startup] Using ports — web: ${WEB_SERVER_PORT}, daemon: ${DAEMON_PORT}`)

  const env = buildChildEnv()

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
        log("[startup] Initialized database from template")
      } else {
        log("[startup] WARNING: No template database found — database may need manual migration")
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
    daemonManager.onDaemonReady((status) => {
      if (status === "ready") {
        log("[startup] Daemon is healthy and ready")
      } else {
        log("[startup] WARNING: Daemon failed to become healthy within timeout")
      }
    })
    daemonManager.start(env)
  }

  // Start embedded web server
  startWebServer(env)

  // Wait for web server to be ready
  log(`[startup] Waiting for web server on localhost:${WEB_SERVER_PORT}...`)
  await waitForServer(`http://localhost:${WEB_SERVER_PORT}`, 30_000)
  log("[startup] Web server is ready, creating main window")

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
  log(`[startup] WARNING: Server at ${url} did not respond within ${timeoutMs}ms`)
}
