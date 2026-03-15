/**
 * Preload script — exposes safe IPC bridge to the renderer.
 *
 * The renderer (Next.js web app) can access these via `window.fxflow`.
 * Context isolation is enabled — no direct Node.js access from renderer.
 *
 * @module preload
 */
import { contextBridge, ipcRenderer } from "electron"

const fxflowApi = {
  /** Get the app version from package.json. */
  getVersion: (): Promise<string> => ipcRenderer.invoke("app:getVersion"),

  /** Get current deployment mode ("local" | "cloud"). */
  getDeploymentMode: (): Promise<"local" | "cloud"> => ipcRenderer.invoke("app:getDeploymentMode"),

  /** Set deployment mode. */
  setDeploymentMode: (mode: "local" | "cloud"): Promise<void> =>
    ipcRenderer.invoke("app:setDeploymentMode", mode),

  /** Get cloud daemon URL. */
  getCloudDaemonUrl: (): Promise<string> => ipcRenderer.invoke("app:getCloudDaemonUrl"),

  /** Set cloud daemon URL. */
  setCloudDaemonUrl: (url: string): Promise<void> =>
    ipcRenderer.invoke("app:setCloudDaemonUrl", url),

  /** Check if daemon child process is running (local mode). */
  isDaemonRunning: (): Promise<boolean> => ipcRenderer.invoke("app:isDaemonRunning"),

  /** Returns true when running inside Electron. */
  isElectron: (): Promise<boolean> => ipcRenderer.invoke("app:isElectron"),

  /** Get auto-launch on login setting. */
  getAutoLaunch: (): Promise<boolean> => ipcRenderer.invoke("app:getAutoLaunch"),

  /** Set auto-launch on login. */
  setAutoLaunch: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke("app:setAutoLaunch", enabled),
}

contextBridge.exposeInMainWorld("fxflow", fxflowApi)

/** Type declaration for the exposed API (use in renderer). */
export type FxflowElectronApi = typeof fxflowApi
