import { createRequire } from "node:module"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { registerTradeTools } from "./tools/trades.js"
import { registerAccountTools } from "./tools/account.js"
import { registerSignalTools } from "./tools/signals.js"
import { registerSetupTools } from "./tools/setups.js"
import { registerAiTools } from "./tools/ai.js"
import { registerSchemaTools } from "./tools/schema.js"
import { registerResources } from "./resources/index.js"
import { registerPrompts } from "./prompts/index.js"

const require = createRequire(import.meta.url)
const rootPkg = require("../../../package.json") as { version: string }

const server = new McpServer({
  name: "fxflow",
  version: rootPkg.version,
})

// Register all tools
registerTradeTools(server)
registerAccountTools(server)
registerSignalTools(server)
registerSetupTools(server)
registerAiTools(server)
registerSchemaTools(server)

// Register resources and prompts
registerResources(server)
registerPrompts(server)

// Connect via stdio transport
const transport = new StdioServerTransport()
await server.connect(transport)

// Log to stderr (stdout is reserved for JSON-RPC)
console.error("[FXFlow MCP] Server started")
