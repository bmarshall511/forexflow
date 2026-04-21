#!/usr/bin/env node
/**
 * Hook: post-edit-meta-log
 * Event: PostToolUse (Write | Edit)
 * Rule: .claude/CLAUDE.md §"Self-modification of .claude/"
 *
 * When a Write/Edit lands on a file inside .claude/, append a one-line
 * entry to the [Unreleased] section of .claude/CHANGELOG.md so
 * self-modifications are auditable. Silent on non-meta edits and on any
 * error.
 *
 * The entry format:
 *   - <YYYY-MM-DD> <type>: `<path>` (<tool>)
 *
 * Where <type> is heuristic:
 *   - "agent" for .claude/agents/*.md
 *   - "skill" for .claude/skills/**
 *   - "rule" for .claude/rules/*.md
 *   - "hook" for .claude/hooks/*
 *   - "context" for .claude/context/*
 *   - "plan" for .claude/plans/*
 *   - "decision" for .claude/decisions/**
 *   - "meta" as fallback
 */

import fs from "node:fs"
import path from "node:path"
import { readStdinJson, allow, failOpen } from "./lib/io.mjs"
import { toRelative } from "./lib/matchers.mjs"

const HOOK = "post-edit-meta-log"

async function main() {
  const input = await readStdinJson()
  if (!input) return allow()

  const tool = input.tool_name
  if (tool !== "Write" && tool !== "Edit") return allow()

  const filePath = input.tool_input?.file_path
  if (typeof filePath !== "string" || filePath.length === 0) return allow()

  const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const relPath = toRelative(filePath, repoRoot)
  if (!relPath.startsWith(".claude/")) return allow()

  // Avoid recursion: the hook edits CHANGELOG.md, which itself matches
  // .claude/ — never log its own edits.
  if (relPath === ".claude/CHANGELOG.md") return allow()

  const changelogPath = path.join(repoRoot, ".claude/CHANGELOG.md")
  if (!fs.existsSync(changelogPath)) return allow()

  try {
    const entry = formatEntry(relPath, tool)
    appendUnreleased(changelogPath, entry)
  } catch {
    // Swallow; this hook is advisory.
  }
  allow()
}

function formatEntry(relPath, tool) {
  const today = new Date().toISOString().slice(0, 10)
  const type = classify(relPath)
  return `- ${today} ${type}: \`${relPath}\` (${tool.toLowerCase()})`
}

function classify(relPath) {
  if (relPath.startsWith(".claude/agents/")) return "agent"
  if (relPath.startsWith(".claude/skills/")) return "skill"
  if (relPath.startsWith(".claude/rules/")) return "rule"
  if (relPath.startsWith(".claude/hooks/")) return "hook"
  if (relPath.startsWith(".claude/context/")) return "context"
  if (relPath.startsWith(".claude/plans/")) return "plan"
  if (relPath.startsWith(".claude/decisions/")) return "decision"
  if (relPath.startsWith(".claude/test-harness/")) return "test-harness"
  if (relPath.startsWith(".claude/config/")) return "config"
  return "meta"
}

function appendUnreleased(changelogPath, entry) {
  const original = fs.readFileSync(changelogPath, "utf8")
  // Find the Unreleased section and append the entry under "### Added" if
  // present, otherwise insert one.
  const unreleasedMatch = original.match(/## \[Unreleased\]\s*\n/)
  if (!unreleasedMatch) return
  const start = unreleasedMatch.index + unreleasedMatch[0].length

  // Find the next section header after Unreleased
  const afterMatch = original.slice(start).match(/\n## /)
  const end = afterMatch ? start + afterMatch.index + 1 : original.length
  const section = original.slice(start, end)

  // Skip if the exact entry already appears (dedup within a session).
  if (section.includes(entry)) return

  const addedMatch = section.match(/### Added\s*\n/)
  let updated
  if (addedMatch) {
    const insertAt = start + addedMatch.index + addedMatch[0].length
    // Insert immediately after the "### Added" line.
    // If the first bullet says "(pending …)", drop it on first real addition.
    let replaced = original
    const pendingLineRe = /\n- \(pending — next sub-phase\)\n/
    if (pendingLineRe.test(original.slice(start, end))) {
      replaced = original.replace(pendingLineRe, "\n")
    }
    updated = replaced.slice(0, insertAt) + entry + "\n" + replaced.slice(insertAt)
  } else {
    updated = original.slice(0, start) + "\n### Added\n\n" + entry + "\n" + original.slice(start)
  }

  fs.writeFileSync(changelogPath, updated, "utf8")
}

main().catch((err) => failOpen(HOOK, err))
