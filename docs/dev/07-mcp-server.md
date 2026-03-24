---
title: "MCP Server"
description: "Architecture, tool registration patterns, and how to extend the FXFlow MCP server."
category: "dev"
order: 7
---

# MCP Server

The MCP (Model Context Protocol) server lives at `apps/mcp-server/` and provides Claude Code with read-only access to live trading data. It communicates with the daemon over HTTP and reads the database directly for historical queries.

## Architecture

```
Claude Code ←→ stdio JSON-RPC ←→ MCP Server ←→ Daemon REST API (port 4100)
                                            ↘→ Database (Prisma/SQLite)
```

- **Transport**: stdio (JSON-RPC over stdin/stdout). The server runs as a child process of Claude Code.
- **Daemon client**: `src/lib/daemon-client.ts` — thin HTTP wrapper that proxies `GET`/`POST` requests to `http://localhost:4100` (configurable via `DAEMON_URL` env var).
- **Direct DB access**: Some tools (trade history, signals, AI analyses) query the database directly via `@fxflow/db` service functions, avoiding the daemon for historical data.
- **Entry point**: `src/index.ts` — creates the MCP server, registers all tool/resource/prompt modules, then connects via `StdioServerTransport`.

## Directory Structure

```
apps/mcp-server/src/
  index.ts              # Server entry — registers modules, connects transport
  lib/
    daemon-client.ts    # HTTP GET/POST proxy to daemon REST API
  tools/
    trades.ts           # get_open_trades, get_pending_orders, get_trade_history, get_trade_details
    account.ts          # get_account_summary, get_daemon_status
    signals.ts          # get_tv_signals, get_signal_audit, get_tv_performance
    setups.ts           # get_active_setups, get_setup_history
    ai.ts               # get_ai_analysis, get_latest_ai_analysis, get_ai_usage
    schema.ts           # get_prisma_schema, query_types, get_db_services
  prompts/
    index.ts            # analyze-trade, daily-summary, debug-signal, review-setups
  resources/
    index.ts            # prisma-schema, shared-types, directory-structure
```

## Tool Registration Pattern

Each tool file exports a `register*Tools(server: McpServer)` function that calls `server.tool()` for each tool. The pattern is consistent:

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { daemonGet } from "../lib/daemon-client.js"

export function registerMyTools(server: McpServer) {
  server.tool(
    "tool_name", // Snake_case tool identifier
    "Human-readable description", // Shown to the LLM
    {
      // Zod schema for parameters (empty {} = no params)
      param: z.string().describe("..."),
    },
    async ({ param }) => {
      // Handler
      try {
        const data = await daemonGet<SomeType>(`/endpoint/${param}`)
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
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
```

Key conventions:

- Tool names use `snake_case` (e.g., `get_open_trades`).
- All parameters are validated with Zod schemas.
- Errors return `isError: true` with a descriptive message rather than throwing.
- Response content is always `type: "text"` with JSON-stringified data.

## How to Add a New Tool

1. **Choose the right file** — add to an existing tool file if it fits the domain, or create a new file under `src/tools/`.

2. **Write the tool** — follow the registration pattern above. Use `daemonGet`/`daemonPost` for live daemon data, or import directly from `@fxflow/db` for database queries.

3. **Register in `index.ts`** — if you created a new file, import and call the register function:

   ```typescript
   import { registerMyTools } from "./tools/my-domain.js"
   registerMyTools(server)
   ```

4. **Test** — start the daemon (`pnpm dev`), then run Claude Code in the project directory. Ask Claude to use your new tool and verify the response.

## Resources

Resources are static data exposed via `fxflow://` URIs. They are registered in `src/resources/index.ts`:

| Resource              | URI                         | Description                            |
| --------------------- | --------------------------- | -------------------------------------- |
| `prisma-schema`       | `fxflow://schema/prisma`    | Full Prisma schema file                |
| `shared-types`        | `fxflow://schema/types`     | All shared TypeScript type definitions |
| `directory-structure` | `fxflow://config/structure` | Monorepo directory structure doc       |

Resources are read from the filesystem at request time, so they always reflect the current state.

## Prompts

Prompts are registered in `src/prompts/index.ts`. Each prompt returns a structured message that guides Claude through a multi-tool analysis workflow. Prompts can accept parameters (e.g., `tradeId`, `signalId`) via Zod schemas.

| Prompt          | Parameters | Description                                       |
| --------------- | ---------- | ------------------------------------------------- |
| `analyze-trade` | `tradeId`  | Trade quality, risk analysis, recommendations     |
| `daily-summary` | (none)     | End-of-day P&L, wins/losses, open risk            |
| `debug-signal`  | `signalId` | Signal audit trail analysis and failure diagnosis |
| `review-setups` | (none)     | Active setup ranking and evaluation               |

## Daemon Client

`src/lib/daemon-client.ts` provides two functions:

- `daemonGet<T>(path)` — `GET` request to daemon, returns parsed JSON.
- `daemonPost<T>(path, body?)` — `POST` request to daemon, returns parsed JSON.

The daemon URL defaults to `http://localhost:4100` and can be overridden via the `DAEMON_URL` environment variable (useful for cloud mode).

## Testing

The MCP server can be tested by:

1. **Manual testing** — start the daemon, then use Claude Code to invoke tools and verify responses.
2. **Unit testing tool handlers** — import the register function, mock `daemonGet`/`daemonPost` and `@fxflow/db` imports, then call `server.tool()` handlers directly.
3. **MCP Inspector** — use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to interactively test tools, resources, and prompts without Claude Code.

## Gotchas

- The MCP server is **read-only** — it does not expose any write operations (no trade placement, no settings changes).
- `stdout` is reserved for JSON-RPC messages. All logging must go to `stderr` (`console.error`).
- The daemon must be running for live-data tools (`get_open_trades`, `get_account_summary`, etc.) to work. Historical DB tools work regardless.
- Tool responses must be `{ content: [{ type: "text", text: string }] }` — the MCP SDK does not support other content types for tool results.
