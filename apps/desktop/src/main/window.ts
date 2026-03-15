/**
 * BrowserWindow management.
 *
 * Creates the main application window, loads the Next.js web app,
 * and persists window position/size across sessions.
 *
 * @module window
 */
import { BrowserWindow, shell } from "electron"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { store } from "./store.js"

const WEB_APP_PORT = 3000
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PRELOAD_PATH = path.join(__dirname, "..", "preload", "index.js")

/** Create the main BrowserWindow. */
export function createMainWindow(): BrowserWindow {
  const bounds = store.get("windowBounds")

  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: 600,
    title: "FXFlow",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
    backgroundColor: "#09090b",
  })

  // Load the web app
  void win.loadURL(`http://localhost:${WEB_APP_PORT}`)

  // Show when ready to avoid white flash
  win.once("ready-to-show", () => {
    win.show()
  })

  // Persist window bounds on move/resize
  const saveBounds = () => {
    const b = win.getBounds()
    store.set("windowBounds", b)
  }
  win.on("resize", saveBounds)
  win.on("move", saveBounds)

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      void shell.openExternal(url)
    }
    return { action: "deny" }
  })

  return win
}
