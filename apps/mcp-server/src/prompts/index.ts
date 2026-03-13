import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export function registerPrompts(server: McpServer) {
  server.prompt(
    "analyze-trade",
    "Generate a structured analysis prompt for a specific trade",
    { tradeId: z.string().describe("The trade ID to analyze") },
    async ({ tradeId }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analyze trade ${tradeId} in the FXFlow trading system.

Use the following MCP tools to gather context:
1. get_trade_details — Get full trade info (entry, SL, TP, events, tags)
2. get_open_trades — Check current positions for correlation
3. get_account_summary — Understand account state and risk exposure
4. get_latest_ai_analysis — Check if there's an existing AI analysis

Then provide:
- Trade quality assessment (entry timing, risk/reward, position sizing)
- Current risk analysis (distance to SL/TP, market conditions)
- Recommendations (hold, adjust SL/TP, partial close, or full close)
- Any correlated exposure concerns`,
        },
      }],
    })
  )

  server.prompt(
    "daily-summary",
    "Generate an end-of-day trading summary",
    {},
    async () => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Generate an end-of-day trading summary for FXFlow.

Use the following MCP tools:
1. get_account_summary — Get P&L for today, this week, this month
2. get_open_trades — Current open positions
3. get_pending_orders — Pending orders
4. get_trade_history — Today's closed trades (filter by today's date)
5. get_tv_performance — TradingView signal performance

Provide:
- Today's P&L breakdown (realized + financing)
- Wins vs losses (count and amounts)
- Open position risk summary
- Notable trades (best/worst)
- TradingView signal accuracy today
- Recommendations for tomorrow`,
        },
      }],
    })
  )

  server.prompt(
    "debug-signal",
    "Troubleshoot a TradingView alert signal that failed or was rejected",
    { signalId: z.string().describe("The signal ID to debug") },
    async ({ signalId }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Debug TradingView alert signal ${signalId} in the FXFlow system.

Use the following MCP tools:
1. get_signal_audit — Get the full audit trail showing each processing stage
2. get_tv_signals — Check recent signals for the same instrument
3. get_daemon_status — Check daemon and CF Worker connection status

Analyze:
- What stage did the signal reach before failing/being rejected?
- What was the rejection reason?
- Was it a configuration issue (kill switch, cooldown, whitelist)?
- Was it a market condition (closed, existing position)?
- Was it a technical failure (daemon disconnected, OANDA error)?
- Recommend how to fix the issue`,
        },
      }],
    })
  )

  server.prompt(
    "review-setups",
    "Review and rank active Trade Finder setups",
    {},
    async () => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Review the active Trade Finder setups in FXFlow.

Use the following MCP tools:
1. get_active_setups — Get all active/approaching setups with scores
2. get_open_trades — Check for existing positions on the same instruments
3. get_account_summary — Understand available margin and risk capacity

For each setup, evaluate:
- Zone quality (score breakdown: strength, time, freshness, trend, curve)
- Risk/reward ratio
- Correlation with existing positions
- Whether auto-trade should be enabled for it
- Rank setups by overall attractiveness`,
        },
      }],
    })
  )
}
