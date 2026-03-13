import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { getAnalysisHistory, getUsageStats, getLatestCompletedAnalysis } from "@fxflow/db"

export function registerAiTools(server: McpServer) {
  server.tool(
    "get_ai_analysis",
    "Get AI analysis history for a specific trade",
    {
      tradeId: z.string().describe("The trade ID"),
      limit: z.number().optional().describe("Max analyses to return (default 5)"),
    },
    async ({ tradeId, limit }) => {
      try {
        const analyses = await getAnalysisHistory(tradeId, limit ?? 5)
        return {
          content: [{ type: "text" as const, text: JSON.stringify(analyses, null, 2) }],
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
    "get_latest_ai_analysis",
    "Get the most recent completed AI analysis for a trade",
    {
      tradeId: z.string().describe("The trade ID"),
    },
    async ({ tradeId }) => {
      try {
        const analysis = await getLatestCompletedAnalysis(tradeId)
        if (!analysis) {
          return {
            content: [{ type: "text" as const, text: `No completed analysis found for trade ${tradeId}` }],
          }
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(analysis, null, 2) }],
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
    "get_ai_usage",
    "Get AI analysis usage statistics: total analyses, token counts, costs, and breakdowns by model and period",
    {},
    async () => {
      try {
        const stats = await getUsageStats()
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
