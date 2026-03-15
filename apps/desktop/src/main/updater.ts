/**
 * Auto-updater — checks GitHub Releases for new versions.
 *
 * On launch and every 4 hours, checks for updates. Downloads in the
 * background and notifies the user when ready to install.
 *
 * @module updater
 */
import { autoUpdater } from "electron-updater"
import { type BrowserWindow, dialog } from "electron"

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on("update-available", (info) => {
    console.log(`[updater] Update available: v${info.version}`)
  })

  autoUpdater.on("update-downloaded", (info) => {
    console.log(`[updater] Update downloaded: v${info.version}`)

    void dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Update Ready",
        message: `FXFlow v${info.version} has been downloaded.`,
        detail: "Restart now to install the update?",
        buttons: ["Restart Now", "Later"],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
  })

  autoUpdater.on("error", (err) => {
    console.error("[updater] Error:", err.message)
  })

  // Check on launch (after short delay to let app settle)
  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch(() => {
      // Silent — no network or no releases yet
    })
  }, 10_000)

  // Periodic check
  setInterval(() => {
    void autoUpdater.checkForUpdates().catch(() => {})
  }, CHECK_INTERVAL_MS)
}
