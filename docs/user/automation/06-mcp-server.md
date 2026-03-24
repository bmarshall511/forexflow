---
title: "MCP Server"
description: "Use Claude Code to query your live trading data, debug signals, and get AI-powered trade analysis."
category: "automation"
order: 6
---

# MCP Server

## What Is the MCP Server?

The MCP (Model Context Protocol) server is a bridge between **Claude Code** (Anthropic's CLI for Claude) and your live FXFlow trading data. It lets you ask Claude questions about your trades, signals, setups, and account — and get answers based on real data, not guesses.

Think of it like giving Claude a window into your trading dashboard. Instead of copying and pasting data into a chat, Claude can look things up directly.

## Why Use It?

- **Ask about your trades**: "How is my EUR/USD position doing?" or "Show me my worst trade this week."
- **Debug signal failures**: "Why was signal abc123 rejected?" — Claude reads the audit trail and explains what went wrong.
- **Get daily summaries**: "Give me an end-of-day summary" — Claude pulls P&L, wins/losses, and open risk automatically.
- **Review setups**: "Which Trade Finder setups look best right now?" — Claude scores and ranks them.

## Requirements

Before using the MCP server, make sure:

1. **The FXFlow daemon is running** — the MCP server queries the daemon for live data. Start it with `pnpm dev` or via the desktop app.
2. **Claude Code is installed** — follow the [Claude Code installation guide](https://docs.anthropic.com/en/docs/claude-code) if you haven't already.

## Configuration

Add the FXFlow MCP server to your `.claude.json` configuration file (in your project root or home directory):

```json
{
  "mcpServers": {
    "fxflow": {
      "command": "node",
      "args": ["--import", "tsx", "apps/mcp-server/src/index.ts"],
      "cwd": "/path/to/FXFlowV2"
    }
  }
}
```

Replace `/path/to/FXFlowV2` with the actual path to your FXFlow project directory.

> [!NOTE]
> If your daemon runs on a different URL (e.g., cloud mode), set the `DAEMON_URL` environment variable in the MCP server config:
>
> ```json
> {
>   "mcpServers": {
>     "fxflow": {
>       "command": "node",
>       "args": ["--import", "tsx", "apps/mcp-server/src/index.ts"],
>       "cwd": "/path/to/FXFlowV2",
>       "env": {
>         "DAEMON_URL": "https://your-daemon.railway.app"
>       }
>     }
>   }
> }
> ```

## Available Tools

The MCP server exposes 17 tools that Claude can use to query your trading data:

### Trading

| Tool                 | Description                                                                       |
| -------------------- | --------------------------------------------------------------------------------- |
| `get_open_trades`    | All currently open trades with live P&L, entry price, SL/TP, and current price    |
| `get_pending_orders` | All pending orders waiting to be filled                                           |
| `get_trade_history`  | Closed trade history with filters (instrument, direction, outcome) and pagination |
| `get_trade_details`  | Full details for a specific trade including events, tags, and AI analyses         |

### Account

| Tool                  | Description                                                                           |
| --------------------- | ------------------------------------------------------------------------------------- |
| `get_account_summary` | OANDA account summary: balance, equity, margin, unrealized P&L, and P&L periods       |
| `get_daemon_status`   | Full daemon status including uptime, connection health, market status, and subsystems |

### TradingView Alerts

| Tool                 | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| `get_tv_signals`     | TradingView alert signals with optional status and instrument filters    |
| `get_signal_audit`   | Detailed audit trail for a specific signal (every processing stage)      |
| `get_tv_performance` | TradingView alerts performance stats: win rate, total P&L, profit factor |

### Trade Finder

| Tool                | Description                                                               |
| ------------------- | ------------------------------------------------------------------------- |
| `get_active_setups` | Active Trade Finder setups with scores, entry/SL/TP, and placement status |
| `get_setup_history` | Historical setups (placed, filled, expired, invalidated)                  |

### AI Analysis

| Tool                     | Description                                                                   |
| ------------------------ | ----------------------------------------------------------------------------- |
| `get_ai_analysis`        | AI analysis history for a specific trade                                      |
| `get_latest_ai_analysis` | Most recent completed AI analysis for a trade                                 |
| `get_ai_usage`           | AI usage statistics: total analyses, token counts, costs, breakdowns by model |

### Schema & Development

| Tool                | Description                                                           |
| ------------------- | --------------------------------------------------------------------- |
| `get_prisma_schema` | Full Prisma database schema with all models, fields, and relations    |
| `query_types`       | Search the shared TypeScript types file for specific type definitions |
| `get_db_services`   | List all database service files with their exported functions         |

## Available Prompts

Prompts are pre-built templates that guide Claude through multi-step analyses. Use them by name in Claude Code:

| Prompt          | Description                                                              |
| --------------- | ------------------------------------------------------------------------ |
| `analyze-trade` | Structured analysis of a specific trade (quality, risk, recommendations) |
| `daily-summary` | End-of-day trading summary with P&L, wins/losses, and open risk          |
| `debug-signal`  | Troubleshoot a TradingView signal that failed or was rejected            |
| `review-setups` | Review and rank active Trade Finder setups by attractiveness             |

## Example Usage

Once configured, you can ask Claude Code things like:

- **"Show me my open trades"** — Claude calls `get_open_trades` and presents a summary.
- **"Why did signal xyz fail?"** — Claude uses `get_signal_audit` to trace the processing stages and explains the failure.
- **"Give me a daily summary"** — Claude uses the `daily-summary` prompt to pull data from multiple tools and write a report.
- **"Analyze trade abc123"** — Claude uses the `analyze-trade` prompt to gather trade details, account state, and existing AI analyses, then provides recommendations.
- **"What's the Prisma schema for the Trade model?"** — Claude reads the schema directly and explains the fields.
- **"Which setups should I trade?"** — Claude uses `review-setups` to evaluate active setups against your current positions and margin.

> [!TIP]
> The MCP server is read-only. It cannot place trades, modify orders, or change settings. It only reads data — so it is safe to use without worrying about accidental actions.
