import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { listSignals, getAuditTrail, getSignalPerformanceStats } from "@fxflow/db"

export function registerSignalTools(server: McpServer) {
  server.tool(
    "get_tv_signals",
    "Get TradingView alert signals with optional filters",
    {
      status: z.string().optional().describe("Filter by status: received, executing, executed, skipped, rejected, failed"),
      instrument: z.string().optional().describe("Filter by instrument (e.g., EUR_USD)"),
      page: z.number().optional().describe("Page number (default 1)"),
      pageSize: z.number().optional().describe("Results per page (default 20)"),
    },
    async ({ status, instrument, page, pageSize }) => {
      try {
        const result = await listSignals({
          status,
          instrument,
          page: page ?? 1,
          pageSize: pageSize ?? 20,
        })
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        }
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "get_signal_audit",
    "Get the detailed audit trail for a specific TradingView signal",
    {
      signalId: z.string().describe("The signal ID"),
    },
    async ({ signalId }) => {
      try {
        const trail = await getAuditTrail(signalId)
        return {
          content: [{ type: "text" as const, text: JSON.stringify(trail, null, 2) }],
        }
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "get_tv_performance",
    "Get TradingView alerts performance stats: win rate, total P&L, profit factor",
    {},
    async () => {
      try {
        const stats = await getSignalPerformanceStats()
        return {
          content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }],
        }
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        }
      }
    }
  )
}
