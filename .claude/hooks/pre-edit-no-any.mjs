#!/usr/bin/env node
/**
 * Hook: pre-edit-no-any
 * Event: PreToolUse (Write | Edit)
 * Rule: .claude/rules/01-typescript.md
 *
 * Blocks TypeScript writes that introduce `: any`, `as any`, or `<any>`
 * without an adjacent `// TODO(type): <reason>` comment justifying the
 * escape hatch.
 */

import fs from "node:fs"
import path from "node:path"
import { readStdinJson, allow, deny, failOpen } from "./lib/io.mjs"
import { toRelative } from "./lib/matchers.mjs"

const HOOK = "pre-edit-no-any"

// Conservative patterns — target clear occurrences, avoid spurious matches
// in strings or comments. Each capture yields the line number.
const PATTERNS = [
  { re: /(^|[^a-zA-Z0-9_])(:\s*any)\b/g, label: ": any" },
  { re: /(^|[^a-zA-Z0-9_])(as\s+any)\b/g, label: "as any" },
  { re: /(<any>|<\s*any\s*>)/g, label: "<any>" },
  { re: /\bany\[\]/g, label: "any[]" },
]

async function main() {
  const input = await readStdinJson()
  if (!input) return allow()

  const tool = input.tool_name
  if (tool !== "Write" && tool !== "Edit") return allow()

  const filePath = input.tool_input?.file_path
  if (typeof filePath !== "string" || filePath.length === 0) return allow()
  if (!/\.(ts|tsx|mts|cts)$/.test(filePath)) return allow()

  const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const relPath = toRelative(filePath, repoRoot)
  if (!relPath || relPath.startsWith("..")) return allow()

  // Skip test fixtures and generated code — they have their own rules.
  if (/\/(generated|__fixtures__)\//.test(relPath)) return allow()
  if (/\.d\.ts$/.test(relPath)) return allow()

  const content = projectedContent(filePath, tool, input.tool_input)
  if (content === null) return allow()

  const offenders = findUnjustified(content)
  if (offenders.length === 0) return allow()

  const lines = offenders
    .map((o) => `  line ${o.line}: ${o.label} — "${o.snippet}"`)
    .join("\n")

  deny(
    `Blocked by pre-edit-no-any: ${relPath}\n` +
      `\n` +
      `Unjustified 'any' usage:\n` +
      lines +
      `\n\n` +
      `Fix: prefer 'unknown' and narrow, or a discriminated union.\n` +
      `If 'any' is genuinely necessary, add a "// TODO(type): reason"\n` +
      `comment on the same or previous line.\n` +
      `\n` +
      `Rule: .claude/rules/01-typescript.md`,
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

function findUnjustified(content) {
  const lines = content.split("\n")
  const offenders = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isComment(line)) continue
    const codePart = stripStrings(line)
    for (const { re, label } of PATTERNS) {
      re.lastIndex = 0
      if (re.test(codePart)) {
        const justified =
          /TODO\(type\)\s*:/i.test(line) ||
          (i > 0 && /TODO\(type\)\s*:/i.test(lines[i - 1]))
        if (!justified) {
          offenders.push({ line: i + 1, label, snippet: line.trim().slice(0, 120) })
        }
      }
    }
  }
  return offenders
}

function isComment(line) {
  const trimmed = line.trim()
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")
}

function stripStrings(line) {
  // Crude but sufficient: remove anything inside ' " or ` quotes on this line.
  return line
    .replace(/"([^"\\]|\\.)*"/g, '""')
    .replace(/'([^'\\]|\\.)*'/g, "''")
    .replace(/`([^`\\]|\\.)*`/g, "``")
}

main().catch((err) => failOpen(HOOK, err))
