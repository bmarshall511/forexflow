import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, "../../../..")

export function registerResources(server: McpServer) {
  server.resource(
    "prisma-schema",
    "fxflow://schema/prisma",
    {
      description: "Full Prisma database schema with all models, fields, and relations",
      mimeType: "text/plain",
    },
    async () => {
      const schema = readFileSync(
        resolve(PROJECT_ROOT, "packages/db/prisma/schema.prisma"),
        "utf-8",
      )
      return { contents: [{ uri: "fxflow://schema/prisma", text: schema, mimeType: "text/plain" }] }
    },
  )

  server.resource(
    "shared-types",
    "fxflow://schema/types",
    {
      description: "All shared TypeScript type definitions (packages/types/src/index.ts)",
      mimeType: "text/plain",
    },
    async () => {
      const types = readFileSync(resolve(PROJECT_ROOT, "packages/types/src/index.ts"), "utf-8")
      return { contents: [{ uri: "fxflow://schema/types", text: types, mimeType: "text/plain" }] }
    },
  )

  server.resource(
    "directory-structure",
    "fxflow://config/structure",
    { description: "FXFlow monorepo directory structure and conventions", mimeType: "text/plain" },
    async () => {
      try {
        const doc = readFileSync(resolve(PROJECT_ROOT, "docs/ai/directory-structure.md"), "utf-8")
        return {
          contents: [{ uri: "fxflow://config/structure", text: doc, mimeType: "text/markdown" }],
        }
      } catch {
        return {
          contents: [
            {
              uri: "fxflow://config/structure",
              text: "Directory structure doc not found",
              mimeType: "text/plain",
            },
          ],
        }
      }
    },
  )
}
