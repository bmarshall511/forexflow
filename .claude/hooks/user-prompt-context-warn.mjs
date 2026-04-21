#!/usr/bin/env node
/**
 * Hook: user-prompt-context-warn
 * Event: UserPromptSubmit
 * Rule: .claude/CLAUDE.md §"Required tooling" (handoff guidance)
 *
 * Emits an advisory message when the session has accumulated enough
 * conversational volume to warrant a /handoff before continuing. Uses a
 * heuristic based on the size of the transcript file under
 * ~/.claude/projects/ if accessible, otherwise no-ops.
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { readStdinJson, failOpen } from "./lib/io.mjs"

const HOOK = "user-prompt-context-warn"

// Heuristic threshold — session transcript size as a rough proxy for
// context utilization. Tuned conservatively: 1.2 MB is typically well
// past 80% utilization on Opus 4.7 with a full system prompt.
const WARN_BYTES = 1_200_000
const URGENT_BYTES = 1_800_000

async function main() {
  const input = await readStdinJson()
  if (!input) return emitNoContext()

  const size = estimateTranscriptSize()
  if (size === null) return emitNoContext()

  if (size >= URGENT_BYTES) {
    emitContext(
      "⚠️  Session context is running low. Recommend running `/handoff` now and continuing in a fresh chat to avoid losing state.",
    )
    return
  }
  if (size >= WARN_BYTES) {
    emitContext(
      "ℹ️  Session context has been running for a while. Consider running `/handoff` at the next good stopping point so the next session can resume cleanly.",
    )
    return
  }

  emitNoContext()
}

function estimateTranscriptSize() {
  try {
    const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd()
    const slug = repoRoot.replace(/^\//, "").replace(/[\/ ]/g, "-").replace(/-{2,}/g, "-")
    // Claude Code stores transcripts under ~/.claude/projects/<slug>/ as
    // .jsonl files. Approximate current session size by the largest
    // recently-modified file in that directory.
    const dir = path.join(os.homedir(), ".claude", "projects", slug)
    if (!fs.existsSync(dir)) return null
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    let largest = 0
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const subdir = path.join(dir, entry.name)
      const files = fs.readdirSync(subdir)
      for (const f of files) {
        if (!f.endsWith(".jsonl")) continue
        try {
          const stat = fs.statSync(path.join(subdir, f))
          if (stat.size > largest) largest = stat.size
        } catch {
          // ignore
        }
      }
    }
    return largest
  } catch {
    return null
  }
}

function emitContext(message) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: message,
      },
    }) + "\n",
  )
  process.exit(0)
}

function emitNoContext() {
  // UserPromptSubmit hooks must emit additionalContext (even if empty) to
  // conform to the schema, or else exit silently with no stdout.
  process.exit(0)
}

main().catch((err) => failOpen(HOOK, err))
