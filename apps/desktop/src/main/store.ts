/**
 * Persistent settings store for Electron main process.
 *
 * Uses electron-store to persist deployment mode, window bounds,
 * auto-launch preference, and cloud configuration across restarts.
 *
 * @module store
 */
import Store from "electron-store"

export interface AppSettings {
  /** Deployment mode: local daemon or cloud daemon */
  deploymentMode: "local" | "cloud"
  /** Cloud daemon URL (only used in cloud mode) */
  cloudDaemonUrl: string
  /** Cloud Turso database URL (only used in cloud mode) */
  cloudDatabaseUrl: string
  /** Cloud Turso auth token (only used in cloud mode) */
  cloudTursoToken: string
  /** Whether to auto-start on login */
  autoLaunch: boolean
  /** Last window position and size */
  windowBounds: { x?: number; y?: number; width: number; height: number }
}

const defaults: AppSettings = {
  deploymentMode: "local",
  cloudDaemonUrl: "",
  cloudDatabaseUrl: "",
  cloudTursoToken: "",
  autoLaunch: true,
  windowBounds: { width: 1280, height: 800 },
}

export const store = new Store<AppSettings>({ defaults })
