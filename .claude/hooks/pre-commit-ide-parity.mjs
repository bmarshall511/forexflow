#!/usr/bin/env node
/**
 * Hook: pre-commit-ide-parity
 * Event: PreToolUse (Bash, on `git commit`)
 * Rule: .claude/rules/00-foundation.md,
 *       .claude/README.md §"Cursor parity"
 *
 * Blocks a commit where .claude/rules/*.md changed but .cursor/rules/
 * was not regenerated. The parity generator lives in
 * scripts/sync-ide-rules.mjs (Sub-phase 7). When the generator does not
 * yet exist (early sub-phase), this hook fails open.
 */

import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { readStdinJson, allow, deny, failOpen } from "./lib/io.mjs"

const HOOK = "pre-commit-ide-parity"

async function main() {
  const input = await readStdinJson()
  if (!input || input.tool_name !== "Bash") return allow()

  const cmd = input.tool_input?.command ?? ""
  if (!/\bgit\s+commit\b/.test(cmd)) return allow()

  const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd()

  // No generator yet → nothing to enforce.
  if (!fs.existsSync(path.join(repoRoot, "scripts/sync-ide-rules.mjs"))) return allow()

  const staged = stagedPaths(repoRoot)
  const rulesChanged = staged.some(
    (p) => p.startsWith(".claude/rules/") && p.endsWith(".md"),
  )
  if (!rulesChanged) return allow()

  const cursorChanged = staged.some((p) => p.startsWith(".cursor/rules/"))

  if (!cursorChanged) {
    deny(
      `Blocked by pre-commit-ide-parity: .claude/rules/ changed but .cursor/rules/ was not regenerated.\n\n` +
        `Run:\n` +
        `  node scripts/sync-ide-rules.mjs\n\n` +
        `Then stage .cursor/rules/ and retry the commit.\n` +
        `\nRule: .claude/README.md §"Cursor parity"`,
    )
    return
  }

  allow()
}

function stagedPaths(repoRoot) {
  try {
    const out = execSync("git diff --cached --name-only --no-color", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 10 * 1024 * 1024,
    })
    return out.split("\n").filter(Boolean)
  } catch {
    return []
  }
}

main().catch((err) => failOpen(HOOK, err))
