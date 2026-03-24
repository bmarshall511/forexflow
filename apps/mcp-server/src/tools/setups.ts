import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { daemonGet } from "../lib/daemon-client.js"
import { formatDaemonError } from "../lib/errors.js"
import { getSetupHistory } from "@fxflow/db"

export function registerSetupTools(server: McpServer) {
  server.tool(
    "get_active_setups",
    "Get Trade Finder active setups with scores, entry/SL/TP, and placement status",
    {},
    async () => {
      try {
        const setups = await daemonGet<unknown[]>("/trade-finder/status")
        return {
          content: [{ type: "text" as const, text: JSON.stringify(setups, null, 2) }],
        }
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatDaemonError(error) }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    "get_setup_history",
    "Get Trade Finder historical setups (placed, filled, expired, invalidated)",
    {
      limit: z.number().optional().describe("Max results to return (default 50)"),
    },
    async ({ limit }) => {
      try {
        const history = await getSetupHistory(limit ?? 50)
        return {
          content: [{ type: "text" as const, text: JSON.stringify(history, null, 2) }],
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
