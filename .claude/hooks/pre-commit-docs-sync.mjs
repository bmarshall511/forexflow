#!/usr/bin/env node
/**
 * Hook: pre-commit-docs-sync
 * Event: PreToolUse (Bash, on `git commit`)
 * Rule: .claude/rules/13-documentation.md
 *
 * Intercepts `git commit` and checks the staged diff against a code →
 * doc map (.claude/config/doc-map.json). When staged source changes hit
 * a mapped code region, the corresponding doc must also be staged (or
 * already current in the working tree with no unstaged edits).
 *
 * Fails open when the map is missing. That keeps early sub-phases
 * frictionless; the map is authored as soon as the code surfaces it
 * should cover exist.
 */

import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { readStdinJson, allow, deny, failOpen } from "./lib/io.mjs"
import { globToRegex } from "./lib/matchers.mjs"

const HOOK = "pre-commit-docs-sync"

// File extensions that never require doc updates on their own.
const SKIP_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\.contract\.test\.[jt]sx?$/,
  /\.visual\.spec\.[jt]sx?$/,
  /\.bench\.[jt]sx?$/,
  /\.(css|scss|sass)$/,
  /\/(generated|__fixtures__|__tests__|__mocks__)\//,
]

async function main() {
  const input = await readStdinJson()
  if (!input || input.tool_name !== "Bash") return allow()

  const cmd = input.tool_input?.command ?? ""
  if (!/\bgit\s+commit\b/.test(cmd)) return allow()

  const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const docMap = loadDocMap(repoRoot)
  if (!docMap || docMap.length === 0) return allow()

  const staged = stagedFilesWithStatus(repoRoot)
  if (staged.length === 0) return allow()

  // Only consider meaningful changes (additions, renames, deletions).
  // Pure Modifications inside existing files often don't require doc work.
  const significant = staged.filter((s) => /^[ARD]/.test(s.status))
  const relevant = significant
    .map((s) => s.path)
    .filter((p) => !SKIP_PATTERNS.some((re) => re.test(p)))

  const missing = [] // { doc: string, labels: string[] }
  const docStaged = new Set(staged.map((s) => s.path))
  const docUncommitted = new Set(uncommittedPaths(repoRoot))

  for (const file of relevant) {
    for (const entry of docMap) {
      if (!globToRegex(entry.pattern).test(file)) continue
      for (const doc of entry.docs) {
        if (docStaged.has(doc) || docUncommitted.has(doc)) continue
        pushUnique(missing, { doc, label: entry.label })
      }
    }
  }

  if (missing.length === 0) return allow()

  const listed = groupByDoc(missing)
    .map((g) => `  • ${g.doc}  (covers: ${g.labels.join(", ")})`)
    .join("\n")

  deny(
    `Blocked by pre-commit-docs-sync: staged changes touch documented areas but the following docs are not staged and have no uncommitted edits:\n\n` +
      listed +
      `\n\n` +
      `Fix one of:\n` +
      `  1. Update the doc to reflect the change, stage it, retry commit\n` +
      `  2. If the doc is genuinely still accurate, stage it as-is to acknowledge\n` +
      `  3. If the change does not require doc update, amend the DOC_MAP in\n` +
      `     .claude/config/doc-map.json\n` +
      `\n` +
      `Rule: .claude/rules/13-documentation.md`,
  )
}

function loadDocMap(repoRoot) {
  try {
    const p = path.join(repoRoot, ".claude/config/doc-map.json")
    if (!fs.existsSync(p)) return null
    const raw = fs.readFileSync(p, "utf8")
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.entries)) return null
    return parsed.entries
  } catch {
    return null
  }
}

function stagedFilesWithStatus(repoRoot) {
  try {
    const out = execSync("git diff --cached --name-status --no-color", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 10 * 1024 * 1024,
    })
    return out
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("\t")
        const status = parts[0]
        const p = parts[parts.length - 1]
        return { status, path: p }
      })
  } catch {
    return []
  }
}

function uncommittedPaths(repoRoot) {
  try {
    const out = execSync("git diff --name-only --no-color", {
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

function pushUnique(list, item) {
  if (!list.some((x) => x.doc === item.doc && x.label === item.label)) list.push(item)
}

function groupByDoc(items) {
  const byDoc = new Map()
  for (const { doc, label } of items) {
    if (!byDoc.has(doc)) byDoc.set(doc, new Set())
    byDoc.get(doc).add(label)
  }
  return [...byDoc.entries()].map(([doc, labels]) => ({ doc, labels: [...labels] }))
}

main().catch((err) => failOpen(HOOK, err))
