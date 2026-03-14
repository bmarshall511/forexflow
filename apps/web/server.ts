/**
 * Custom Next.js server with WebSocket proxy.
 *
 * Used in production/remote access to proxy browser WebSocket connections
 * through the same origin as the web app, enabling single-tunnel deployment.
 *
 * In development, the standard `next dev` command is used instead (no proxy needed).
 *
 * Usage:
 *   NODE_ENV=production node dist/server.js
 */

import { createServer, type IncomingMessage } from "node:http"
import { parse } from "node:url"
import next from "next"
import { WebSocketServer, WebSocket } from "ws"

const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOSTNAME ?? "0.0.0.0"
const port = parseInt(process.env.PORT ?? "3000", 10)
const daemonWsUrl = process.env.DAEMON_WS_URL ?? "ws://localhost:4100"

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

async function main() {
  await app.prepare()

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true)
    void handle(req, res, parsedUrl)
  })

  // WebSocket proxy: /ws → daemon WebSocket
  const wss = new WebSocketServer({ noServer: true })

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const { pathname } = parse(req.url ?? "/")

    if (pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (clientWs) => {
        const daemonWs = new WebSocket(daemonWsUrl)

        daemonWs.on("open", () => {
          // Pipe messages bidirectionally
          clientWs.on("message", (data) => {
            if (daemonWs.readyState === WebSocket.OPEN) {
              daemonWs.send(data)
            }
          })

          daemonWs.on("message", (data) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(data)
            }
          })
        })

        daemonWs.on("close", () => {
          if (clientWs.readyState === WebSocket.OPEN) clientWs.close()
        })

        daemonWs.on("error", (err) => {
          console.error("[ws-proxy] Daemon connection error:", err.message)
          if (clientWs.readyState === WebSocket.OPEN) clientWs.close()
        })

        clientWs.on("close", () => {
          if (daemonWs.readyState === WebSocket.OPEN) daemonWs.close()
        })

        clientWs.on("error", (err) => {
          console.error("[ws-proxy] Client connection error:", err.message)
          if (daemonWs.readyState === WebSocket.OPEN) daemonWs.close()
        })
      })
    } else {
      socket.destroy()
    }
  })

  server.listen(port, hostname, () => {
    console.log(`[server] FXFlow ready on http://${hostname}:${port}`)
    console.log(`[server] WebSocket proxy: /ws → ${daemonWsUrl}`)
  })
}

main().catch((err) => {
  console.error("[server] Fatal error:", err)
  process.exit(1)
})
