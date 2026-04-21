/**
 * File-size limit lookup and LOC counting.
 *
 * The authoritative limit table lives in this file; the rule
 * `.claude/rules/07-file-size.md` is the human-readable mirror.
 * Per-path overrides come from `.claude/config/size-exceptions.json`.
 */

import fs from "node:fs"
import path from "node:path"
import { globToRegex } from "./matchers.mjs"

/**
 * Ordered list of `{ pattern, limit }` rules. First match wins.
 * Earlier entries are more specific.
 */
const LIMIT_TABLE = [
  // Tests — generous limit
  { pattern: "**/*.test.{ts,tsx}", limit: 500 },
  { pattern: "**/*.spec.{ts,tsx}", limit: 500 },
  { pattern: "**/*.bench.{ts,tsx}", limit: 500 },

  // Generated code — no limit (returned as Infinity)
  { pattern: "**/generated/**", limit: Infinity },
  { pattern: "**/*.d.ts", limit: Infinity },

  // Configuration files
  { pattern: "**/*.config.{ts,mjs,cjs,js}", limit: Infinity },
  { pattern: "**/prisma/schema.prisma", limit: Infinity },
  { pattern: "**/prisma/migrations/**", limit: Infinity },

  // Apps — route handlers
  { pattern: "apps/web/src/app/api/**/route.ts", limit: 250 },
  { pattern: "apps/web/src/app/**/page.tsx", limit: 250 },
  { pattern: "apps/web/src/app/**/layout.tsx", limit: 200 },

  // Web components and hooks
  { pattern: "apps/web/src/components/**/*.tsx", limit: 150 },
  { pattern: "apps/web/src/hooks/*.ts", limit: 200 },
  { pattern: "apps/web/src/state/**/*.tsx", limit: 200 },
  { pattern: "apps/web/src/lib/**/*.ts", limit: 200 },

  // Daemon
  { pattern: "apps/daemon/src/index.ts", limit: 500 },
  { pattern: "apps/daemon/src/server.ts", limit: 500 },
  { pattern: "apps/daemon/src/**/*.ts", limit: 400 },

  // CF Worker
  { pattern: "apps/cf-worker/src/**/*.ts", limit: 300 },

  // MCP server
  { pattern: "apps/mcp-server/src/tools/*.ts", limit: 200 },
  { pattern: "apps/mcp-server/src/**/*.ts", limit: 250 },

  // Desktop
  { pattern: "apps/desktop/src/main/**/*.ts", limit: 300 },
  { pattern: "apps/desktop/src/preload/**/*.ts", limit: 200 },

  // Packages
  { pattern: "packages/shared/src/trading-core/**/*.ts", limit: 300 },
  { pattern: "packages/shared/src/**/*.ts", limit: 200 },
  { pattern: "packages/db/src/*-service.ts", limit: 300 },
  { pattern: "packages/db/src/**/*.ts", limit: 250 },
  { pattern: "packages/types/src/**/*.ts", limit: 400 },
  { pattern: "packages/config/src/**/*.ts", limit: 200 },
  { pattern: "packages/logger/src/**/*.ts", limit: 150 },

  // .claude/ artifacts
  { pattern: ".claude/rules/*.md", limit: 400 },
  { pattern: ".claude/agents/*.md", limit: 250 },
  { pattern: ".claude/skills/**/SKILL.md", limit: 200 },
  { pattern: ".claude/hooks/*.mjs", limit: 200 },
  { pattern: ".claude/hooks/lib/*.mjs", limit: 150 },
  { pattern: ".claude/context/*.md", limit: 500 },
  { pattern: ".claude/plans/*.md", limit: 300 },
  { pattern: ".claude/decisions/**/*.md", limit: 250 },

  // Fallback — any TS file without a more specific rule
  { pattern: "**/*.{ts,tsx,mts,cts}", limit: 400 },
]

/**
 * Look up the size limit for a repo-relative forward-slash path.
 * Returns Infinity when no limit applies.
 * @param {string} relPath
 * @param {{ overrides?: Record<string, number> }} [opts]
 */
export function limitFor(relPath, opts = {}) {
  // Explicit path-level override beats everything.
  if (opts.overrides && relPath in opts.overrides) {
    return opts.overrides[relPath]
  }
  for (const { pattern, limit } of LIMIT_TABLE) {
    if (globToRegex(pattern).test(relPath)) return limit
  }
  return Infinity
}

/**
 * Count source lines in a string. All lines count (including blank and
 * comment-only) since that matches the rule as written.
 * @param {string} text
 */
export function countLines(text) {
  if (!text) return 0
  const lines = text.split("\n")
  // Drop a trailing empty line caused by a final newline
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
  return lines.length
}

/**
 * Load per-path overrides from .claude/config/size-exceptions.json if present.
 * Returns `{}` when missing or malformed.
 * @param {string} repoRoot
 */
export function loadOverrides(repoRoot) {
  try {
    const p = path.join(repoRoot, ".claude/config/size-exceptions.json")
    if (!fs.existsSync(p)) return {}
    const raw = fs.readFileSync(p, "utf8")
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed.paths || {} : {}
  } catch {
    return {}
  }
}
