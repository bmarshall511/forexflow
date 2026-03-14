import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, "../../../..")

export function registerSchemaTools(server: McpServer) {
  server.tool(
    "get_prisma_schema",
    "Read the Prisma database schema showing all models, fields, relations, and indexes",
    {},
    async () => {
      try {
        const schema = readFileSync(
          resolve(PROJECT_ROOT, "packages/db/prisma/schema.prisma"),
          "utf-8",
        )
        return {
          content: [{ type: "text" as const, text: schema }],
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error reading schema: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        }
      }
    },
  )

  server.tool(
    "query_types",
    "Search the shared types file (packages/types/src/index.ts) for specific type definitions",
    {
      search: z
        .string()
        .describe(
          "Search term to find in the types file (e.g., 'TradeStatus', 'AiAnalysis', 'WebSocket')",
        ),
    },
    async ({ search }) => {
      try {
        const typesFile = readFileSync(
          resolve(PROJECT_ROOT, "packages/types/src/index.ts"),
          "utf-8",
        )
        const lines = typesFile.split("\n")
        const matches: string[] = []
        const searchLower = search.toLowerCase()

        for (let i = 0; i < lines.length; i++) {
          if (lines[i]!.toLowerCase().includes(searchLower)) {
            // Include context: 2 lines before, the match, and lines until next blank line or 20 lines
            const start = Math.max(0, i - 2)
            let end = i + 1
            while (end < lines.length && end < i + 20 && lines[end]!.trim() !== "") {
              end++
            }
            matches.push(`--- Line ${start + 1} ---\n${lines.slice(start, end).join("\n")}`)
          }
        }

        if (matches.length === 0) {
          return {
            content: [
              { type: "text" as const, text: `No matches found for "${search}" in types file` },
            ],
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${matches.length} matches for "${search}":\n\n${matches.slice(0, 10).join("\n\n")}${matches.length > 10 ? `\n\n... and ${matches.length - 10} more matches` : ""}`,
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
    "get_db_services",
    "List all database service files with their exported functions",
    {},
    async () => {
      try {
        const { readdirSync } = await import("fs")
        const dbSrcDir = resolve(PROJECT_ROOT, "packages/db/src")
        const files = readdirSync(dbSrcDir)
          .filter((f: string) => f.endsWith("-service.ts"))
          .sort()

        const services: string[] = []
        for (const file of files) {
          const content = readFileSync(resolve(dbSrcDir, file), "utf-8")
          const exports = content
            .split("\n")
            .filter(
              (line: string) =>
                line.startsWith("export async function") || line.startsWith("export function"),
            )
            .map((line: string) => {
              const match = line.match(/export (?:async )?function (\w+)/)
              return match ? match[1] : null
            })
            .filter(Boolean)
          services.push(`${file}: ${exports.join(", ")}`)
        }

        return {
          content: [{ type: "text" as const, text: services.join("\n") }],
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
