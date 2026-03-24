/**
 * Daemon child process manager for local mode.
 *
 * Spawns the FXFlow daemon as a child process, monitors health,
 * and auto-restarts on crash with exponential backoff.
 *
 * @module daemon-manager
 */
import { fork, type ChildProcess } from "node:child_process"
import path from "node:path"
import { app } from "electron"

const MAX_RESTARTS = 5
const RESTART_DELAYS = [1000, 2000, 4000, 8000, 16000]
const HEALTH_CHECK_INTERVAL_MS = 1000
const HEALTH_CHECK_TIMEOUT_MS = 30_000

export type DaemonReadyStatus = "ready" | "failed"

export class DaemonManager {
  private process: ChildProcess | null = null
  private restartCount = 0
  private stopping = false
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null
  private onStatusChange: (running: boolean) => void
  private onReady: ((status: DaemonReadyStatus) => void) | null = null

  constructor(onStatusChange: (running: boolean) => void) {
    this.onStatusChange = onStatusChange
  }

  /** Register a one-shot callback for daemon health readiness after start. */
  onDaemonReady(cb: (status: DaemonReadyStatus) => void): void {
    this.onReady = cb
  }

  /** Start the daemon as a child process. */
  start(env: Record<string, string>): void {
    if (this.process) return

    this.stopping = false
    const daemonEntry = this.resolveDaemonEntry()
    const dataDir = path.join(app.getPath("userData"), "data")

    const mergedEnv: Record<string, string> = {
      ...process.env,
      ...env,
      DATABASE_URL: env.DATABASE_URL || `file:${path.join(dataDir, "fxflow.db")}`,
      DAEMON_PORT: env.DAEMON_PORT || "4100",
      NODE_ENV: "production",
      FXFLOW_ELECTRON: "1",
    } as Record<string, string>

    this.process = fork(daemonEntry, [], {
      execArgv: ["--import", "tsx/esm"],
      env: mergedEnv,
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      silent: true,
    })

    this.process.stdout?.on("data", (data: Buffer) => {
      console.log(`[daemon] ${data.toString().trim()}`)
    })

    this.process.stderr?.on("data", (data: Buffer) => {
      console.error(`[daemon] ${data.toString().trim()}`)
    })

    this.process.on("exit", (code) => {
      this.clearHealthCheck()
      this.process = null
      this.onStatusChange(false)

      if (this.stopping) return

      console.warn(`[daemon] Exited with code ${code}`)

      if (this.restartCount < MAX_RESTARTS) {
        const delay = RESTART_DELAYS[Math.min(this.restartCount, RESTART_DELAYS.length - 1)]
        console.log(`[daemon] Restarting in ${delay}ms (attempt ${this.restartCount + 1})`)
        this.restartCount++
        setTimeout(() => this.start(env), delay)
      } else {
        console.error(`[daemon] Max restarts (${MAX_RESTARTS}) reached. Giving up.`)
      }
    })

    this.process.on("error", (err) => {
      console.error(`[daemon] Process error: ${err.message}`)
    })

    this.onStatusChange(true)
    this.restartCount = 0

    // Start health check polling after fork
    const port = env.DAEMON_PORT || "4100"
    this.startHealthCheck(port)
  }

  /** Gracefully stop the daemon. */
  async stop(): Promise<void> {
    this.stopping = true
    this.clearHealthCheck()

    if (!this.process) return

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn("[daemon] Force-killing after timeout")
        this.process?.kill("SIGKILL")
        this.process = null
        resolve()
      }, 5000)

      this.process!.once("exit", () => {
        clearTimeout(timeout)
        this.process = null
        resolve()
      })

      this.process!.kill("SIGTERM")
    })
  }

  /** Whether the daemon process is currently running. */
  get isRunning(): boolean {
    return this.process !== null
  }

  /** Resolve path to daemon entry point (tsx in dev, compiled in production). */
  private resolveDaemonEntry(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, "daemon-bundle", "src", "index.ts")
    }
    // Development: run from monorepo source
    return path.join(app.getAppPath(), "..", "..", "daemons", "src", "index.ts")
  }

  /**
   * Poll the daemon /health endpoint until it responds successfully or timeout.
   * Emits "ready" or "failed" via the onReady callback.
   */
  private startHealthCheck(port: string): void {
    this.clearHealthCheck()
    const url = `http://localhost:${port}/health`
    const startTime = Date.now()

    console.log(`[daemon] Health check polling ${url} (timeout ${HEALTH_CHECK_TIMEOUT_MS}ms)`)

    this.healthCheckTimer = setInterval(async () => {
      // If process died while polling, stop immediately
      if (!this.process) {
        this.clearHealthCheck()
        this.emitReady("failed")
        return
      }

      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(2000),
        })
        if (res.ok) {
          console.log("[daemon] Health check passed — daemon is ready")
          this.clearHealthCheck()
          this.emitReady("ready")
          return
        }
      } catch {
        // Not ready yet
      }

      if (Date.now() - startTime >= HEALTH_CHECK_TIMEOUT_MS) {
        console.error("[daemon] Health check timed out — daemon failed to become ready")
        this.clearHealthCheck()
        this.emitReady("failed")
      }
    }, HEALTH_CHECK_INTERVAL_MS)
  }

  /** Clear the health check polling interval. */
  private clearHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }
  }

  /** Fire the one-shot onReady callback and clear it. */
  private emitReady(status: DaemonReadyStatus): void {
    if (this.onReady) {
      const cb = this.onReady
      this.onReady = null
      cb(status)
    }
  }
}
