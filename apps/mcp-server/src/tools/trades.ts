import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { daemonGet } from "../lib/daemon-client.js"
import { listTrades, getTradeWithDetails } from "@fxflow/db"

export function registerTradeTools(server: McpServer) {
  server.tool(
    "get_open_trades",
    "Get all currently open trades with live P&L, entry price, SL/TP, and current price",
    {},
    async () => {
      try {
        const status = await daemonGet<{ positions: { open: unknown[] } }>("/status")
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(status.positions?.open ?? [], null, 2) },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching open trades: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        }
      }
    },
  )

  server.tool("get_pending_orders", "Get all pending orders waiting to be filled", {}, async () => {
    try {
      const status = await daemonGet<{ positions: { pending: unknown[] } }>("/status")
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(status.positions?.pending ?? [], null, 2) },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching pending orders: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  })

  server.tool(
    "get_trade_history",
    "Get closed trade history with optional filters. Returns paginated results.",
    {
      instrument: z.string().optional().describe("Filter by instrument (e.g., EUR_USD)"),
      direction: z.enum(["long", "short"]).optional().describe("Filter by trade direction"),
      outcome: z
        .enum(["win", "loss", "breakeven", "cancelled"])
        .optional()
        .describe("Filter by trade outcome"),
      limit: z.number().optional().describe("Max results to return (default 20, max 100)"),
      offset: z.number().optional().describe("Offset for pagination (default 0)"),
    },
    async ({ instrument, direction, outcome, limit, offset }) => {
      try {
        const result = await listTrades({
          status: "closed",
          instrument,
          direction,
          outcome,
          limit: Math.min(limit ?? 20, 100),
          offset: offset ?? 0,
        })
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  trades: result.trades,
                  totalCount: result.totalCount,
                  page: result.page,
                  pageSize: result.pageSize,
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
    "get_trade_details",
    "Get full details for a specific trade including events, tags, and AI analyses",
    {
      tradeId: z.string().describe("The trade ID (database UUID)"),
    },
    async ({ tradeId }) => {
      try {
        const trade = await getTradeWithDetails(tradeId)
        if (!trade) {
          return {
            content: [{ type: "text" as const, text: `Trade ${tradeId} not found` }],
            isError: true,
          }
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(trade, null, 2) }],
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
