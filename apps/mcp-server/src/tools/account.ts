import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { daemonGet } from "../lib/daemon-client.js"
import type { DaemonStatusSnapshot } from "@fxflow/types"

export function registerAccountTools(server: McpServer) {
  server.tool(
    "get_account_summary",
    "Get OANDA account summary: balance, equity, margin, unrealized P&L, and connection status",
    {},
    async () => {
      try {
        const status = await daemonGet<DaemonStatusSnapshot>("/status")
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  tradingMode: status.tradingMode,
                  connectionStatus: status.oanda?.status,
                  account: status.accountOverview?.summary,
                  pnl: status.accountOverview
                    ? {
                        today: status.accountOverview.pnl.today,
                        thisWeek: status.accountOverview.pnl.thisWeek,
                        thisMonth: status.accountOverview.pnl.thisMonth,
                      }
                    : null,
                  market: status.market,
                },
                null,
                2,
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        }
      }
    },
  )

  server.tool(
    "get_daemon_status",
    "Get full daemon status including uptime, connection health, market status, and subsystem states",
    {},
    async () => {
      try {
        const status = await daemonGet<DaemonStatusSnapshot>("/status")
        return {
          content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }],
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        }
      }
    },
  )
}
