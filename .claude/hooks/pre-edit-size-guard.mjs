#!/usr/bin/env node
/**
 * Hook: pre-edit-size-guard
 * Event: PreToolUse (Write | Edit)
 * Rule: .claude/rules/07-file-size.md
 *
 * Blocks writes that would push a file past the size limit for its path.
 * For Edit tool calls, estimates the post-edit line count by applying the
 * proposed diff to the current file. Overrides come from
 * .claude/config/size-exceptions.json.
 */

import fs from "node:fs"
import path from "node:path"
import { readStdinJson, allow, deny, failOpen } from "./lib/io.mjs"
import { toRelative } from "./lib/matchers.mjs"
import { limitFor, countLines, loadOverrides } from "./lib/size.mjs"

const HOOK = "pre-edit-size-guard"

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

  const overrides = loadOverrides(repoRoot)
  const limit = limitFor(relPath, { overrides })
  if (limit === Infinity) return allow()

  let projected
  if (tool === "Write") {
    const content = input.tool_input?.content ?? ""
    projected = countLines(content)
  } else {
    projected = estimatePostEditLines(filePath, input.tool_input)
    if (projected === null) return allow()
  }

  if (projected > limit) {
    deny(
      `Blocked by pre-edit-size-guard: ${relPath} would be ${projected} lines; limit is ${limit}.\n` +
        `\n` +
        `Options:\n` +
        `  1. Refactor by responsibility (dispatch the /refactor skill).\n` +
        `  2. If the size is genuinely justified, write an ADR in .claude/decisions/\n` +
        `     and add an override to .claude/config/size-exceptions.json.\n` +
        `\n` +
        `Rule: .claude/rules/07-file-size.md`,
    )
    return
  }

  allow()
}

/**
 * Read the current file and apply the Edit tool's old_string/new_string
 * (or replace_all) to produce the projected line count.
 * Returns null on any uncertainty — the hook fails open in that case.
 */
function estimatePostEditLines(filePath, toolInput) {
  try {
    const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
    if (!fs.existsSync(absolute)) return null
    const current = fs.readFileSync(absolute, "utf8")
    const { old_string: oldStr, new_string: newStr, replace_all } = toolInput || {}
    if (typeof oldStr !== "string" || typeof newStr !== "string") return null
    if (oldStr === "") return null
    const applied = replace_all
      ? current.split(oldStr).join(newStr)
      : current.replace(oldStr, newStr)
    return countLines(applied)
  } catch {
    return null
  }
}

main().catch((err) => failOpen(HOOK, err))
