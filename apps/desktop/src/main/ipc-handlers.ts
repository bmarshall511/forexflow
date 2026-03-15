/**
 * IPC handlers — bridge between main process and renderer (preload).
 *
 * Exposes safe APIs for the renderer to query deployment mode,
 * daemon status, and app version.
 *
 * @module ipc-handlers
 */
import { ipcMain, app } from "electron"
import { store } from "./store.js"
import type { DaemonManager } from "./daemon-manager.js"

export function registerIpcHandlers(daemonManager: DaemonManager | null): void {
  ipcMain.handle("app:getVersion", () => app.getVersion())

  ipcMain.handle("app:getDeploymentMode", () => store.get("deploymentMode"))

  ipcMain.handle("app:setDeploymentMode", (_event, mode: "local" | "cloud") => {
    store.set("deploymentMode", mode)
  })

  ipcMain.handle("app:getCloudDaemonUrl", () => store.get("cloudDaemonUrl"))

  ipcMain.handle("app:setCloudDaemonUrl", (_event, url: string) => {
    store.set("cloudDaemonUrl", url)
  })

  ipcMain.handle("app:isDaemonRunning", () => daemonManager?.isRunning ?? false)

  ipcMain.handle("app:isElectron", () => true)

  ipcMain.handle("app:getAutoLaunch", () => store.get("autoLaunch"))

  ipcMain.handle("app:setAutoLaunch", (_event, enabled: boolean) => {
    store.set("autoLaunch", enabled)
    app.setLoginItemSettings({ openAtLogin: enabled })
  })
}
