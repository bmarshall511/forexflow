/**
 * Splash/loading window shown immediately on app launch.
 *
 * Displays a branded loading screen while the Next.js server
 * and daemon start up in the background. Closed once the main
 * window is ready to show.
 *
 * @module splash
 */
import { BrowserWindow } from "electron"

const SPLASH_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #09090b;
      color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      -webkit-app-region: drag;
      user-select: none;
    }
    .logo {
      width: 72px;
      height: 72px;
      margin-bottom: 24px;
      animation: pulse 2s ease-in-out infinite;
    }
    .title {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 14px;
      color: #a1a1aa;
      margin-bottom: 32px;
    }
    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid #27272a;
      border-top-color: #a1a1aa;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  </style>
</head>
<body>
  <svg class="logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="#18181b"/>
    <text x="50" y="62" text-anchor="middle" font-size="40" font-weight="700" fill="#fafafa" font-family="-apple-system, system-ui, sans-serif">FX</text>
  </svg>
  <div class="title">FXFlow</div>
  <div class="subtitle">Starting trading system...</div>
  <div class="spinner"></div>
</body>
</html>`

export function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 360,
    height: 400,
    frame: false,
    transparent: false,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#09090b",
    titleBarStyle: "hidden",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  void splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SPLASH_HTML)}`)
  splash.show()

  return splash
}
