/**
 * System tray icon and menu for macOS.
 *
 * Shows FXFlow in the menu bar with status indicator and
 * quick access to show/hide window and quit.
 *
 * @module tray
 */
import { Tray, Menu, nativeImage, type BrowserWindow } from "electron"
import path from "node:path"
import { app } from "electron"

export class TrayManager {
  private tray: Tray | null = null
  private daemonRunning = false

  /** Create the system tray icon and context menu. */
  create(mainWindow: BrowserWindow): void {
    const iconPath = this.resolveIconPath()
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 })
    icon.setTemplateImage(true)

    this.tray = new Tray(icon)
    this.tray.setToolTip("FXFlow")

    this.updateMenu(mainWindow)

    // Click tray icon to toggle window visibility
    this.tray.on("click", () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    })
  }

  /** Update tray menu (call when daemon status changes). */
  updateMenu(mainWindow: BrowserWindow): void {
    if (!this.tray) return

    const statusLabel = this.daemonRunning ? "Daemon: Running" : "Daemon: Stopped"

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show FXFlow",
        click: () => {
          mainWindow.show()
          mainWindow.focus()
        },
      },
      { type: "separator" },
      { label: statusLabel, enabled: false },
      { type: "separator" },
      {
        label: "Quit FXFlow",
        click: () => {
          app.quit()
        },
      },
    ])

    this.tray.setContextMenu(contextMenu)
  }

  /** Update daemon status shown in tray menu. */
  setDaemonStatus(running: boolean, mainWindow: BrowserWindow): void {
    this.daemonRunning = running
    this.updateMenu(mainWindow)
  }

  /** Remove the tray icon. */
  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }

  private resolveIconPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, "assets", "tray-icon.png")
    }
    return path.join(app.getAppPath(), "assets", "tray-icon.png")
  }
}
