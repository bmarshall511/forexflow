#!/usr/bin/env node
/**
 * Hook: pre-edit-no-personal-names
 * Event: PreToolUse (Write | Edit)
 * Rule: .claude/rules/00-foundation.md §5
 *
 * Blocks writes that introduce personal names, handles, or emails from
 * the reserved-identifiers list into any file *except* the narrow set of
 * GitHub infrastructure files that require handles (CODEOWNERS, security
 * advisory URLs hardcoded into templates).
 *
 * Reserved identifiers live in .claude/config/reserved-identifiers.json
 * (gitignored, per-user list). Missing config = empty list = no matches =
 * hook does nothing. This is intentional: the config is how a maintainer
 * scopes the hook to their own context.
 */

import fs from "node:fs"
import path from "node:path"
import { readStdinJson, allow, deny, failOpen } from "./lib/io.mjs"
import { toRelative } from "./lib/matchers.mjs"

const HOOK = "pre-edit-no-personal-names"

// Files where personal handles are allowed because GitHub's infrastructure
// requires them. The rule authorizes these narrowly; anything else blocks.
const ALLOWED_PATHS = [
  ".github/CODEOWNERS",
]

async function main() {
  const input = await readStdinJson()
  if (!input) return allow()

  const tool = input.tool_name
  if (tool !== "Write" && tool !== "Edit") return allow()

  const filePath = input.tool_input?.file_path
  if (typeof filePath !== "string" || filePath.length === 0) return allow()

  const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const relPath = toRelative(filePath, repoRoot)
  if (!relPath || relPath.startsWith("..")) return allow()

  if (ALLOWED_PATHS.includes(relPath)) return allow()

  const reserved = loadReserved(repoRoot)
  if (reserved.length === 0) return allow()

  const content = projectedContent(filePath, tool, input.tool_input)
  if (content === null) return allow()

  const hits = []
  for (const entry of reserved) {
    if (!entry || typeof entry !== "string") continue
    const re = new RegExp(`\\b${escapeRegex(entry)}\\b`, "gi")
    let m
    while ((m = re.exec(content)) !== null) {
      const line = content.slice(0, m.index).split("\n").length
      hits.push({ value: entry, line })
      if (hits.length >= 5) break
    }
    if (hits.length >= 5) break
  }

  if (hits.length === 0) return allow()

  const listed = hits.map((h) => `  line ${h.line}: "${h.value}"`).join("\n")
  deny(
    `Blocked by pre-edit-no-personal-names: ${relPath}\n` +
      `\n` +
      `The content introduces reserved identifiers:\n` +
      listed +
      `\n\n` +
      `Rule: never reference individuals (names, handles, emails) in app\n` +
      `artifacts. Use roles ("maintainer", "contributor") instead.\n` +
      `\n` +
      `The sole exception is .github/CODEOWNERS, where GitHub's format\n` +
      `requires a handle. All other files must block.\n` +
      `\n` +
      `Rule source: .claude/rules/00-foundation.md §5`,
  )
}

function projectedContent(filePath, tool, toolInput) {
  try {
    if (tool === "Write") return toolInput?.content ?? ""
    const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
    if (!fs.existsSync(absolute)) return null
    const current = fs.readFileSync(absolute, "utf8")
    const { old_string: oldStr, new_string: newStr, replace_all } = toolInput || {}
    if (typeof oldStr !== "string" || typeof newStr !== "string") return null
    if (oldStr === "") return current
    return replace_all ? current.split(oldStr).join(newStr) : current.replace(oldStr, newStr)
  } catch {
    return null
  }
}

function loadReserved(repoRoot) {
  try {
    const p = path.join(repoRoot, ".claude/config/reserved-identifiers.json")
    if (!fs.existsSync(p)) return []
    const raw = fs.readFileSync(p, "utf8")
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (parsed && Array.isArray(parsed.identifiers)) return parsed.identifiers
    return []
  } catch {
    return []
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

main().catch((err) => failOpen(HOOK, err))
