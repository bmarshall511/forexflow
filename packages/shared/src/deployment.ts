/**
 * Deployment mode configuration — drives behavior across the stack.
 *
 * - "local": daemon runs on the same machine, SQLite in app data directory.
 * - "cloud": daemon runs on a remote server (Railway/Fly.io), DB on Turso.
 *
 * @module deployment
 */

/** How the app is deployed. */
export type DeploymentMode = "local" | "cloud"

/** Resolved deployment configuration used by all layers. */
export interface DeploymentConfig {
  /** Current deployment mode */
  mode: DeploymentMode
  /** Daemon REST URL (local: http://localhost:4100, cloud: https://daemon.railway.app) */
  daemonUrl: string
  /** Daemon WebSocket URL (local: ws://localhost:4100, cloud: wss://daemon.railway.app) */
  daemonWsUrl: string
  /** Whether running inside Electron shell */
  isElectron: boolean
}

/**
 * Default configuration for local mode.
 * Used when no overrides are set.
 */
export const LOCAL_DEFAULTS: DeploymentConfig = {
  mode: "local",
  daemonUrl: "http://localhost:4100",
  daemonWsUrl: "ws://localhost:4100",
  isElectron: false,
}

/**
 * Resolve deployment configuration from environment variables.
 *
 * Environment variables:
 * - `FXFLOW_MODE` — "local" | "cloud" (default: "local")
 * - `DAEMON_URL` — daemon REST URL override
 * - `DAEMON_WS_URL` — daemon WebSocket URL override
 * - `FXFLOW_ELECTRON` — "1" if running inside Electron
 */
export function resolveDeploymentConfig(env: Record<string, string | undefined>): DeploymentConfig {
  const mode = (env.FXFLOW_MODE as DeploymentMode) || "local"
  const isElectron = env.FXFLOW_ELECTRON === "1"

  if (mode === "cloud") {
    const daemonUrl = env.DAEMON_URL || env.CLOUD_DAEMON_URL || ""
    const daemonWsUrl =
      env.DAEMON_WS_URL || env.CLOUD_DAEMON_WS_URL || daemonUrl.replace(/^http/, "ws") || ""

    return { mode, daemonUrl, daemonWsUrl, isElectron }
  }

  return {
    mode,
    daemonUrl: env.DAEMON_URL || LOCAL_DEFAULTS.daemonUrl,
    daemonWsUrl: env.DAEMON_WS_URL || LOCAL_DEFAULTS.daemonWsUrl,
    isElectron,
  }
}
