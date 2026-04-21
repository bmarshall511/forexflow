#!/usr/bin/env node
/**
 * Hook: post-edit-format
 * Event: PostToolUse (Write | Edit)
 * Rule: .claude/rules/08-naming.md (formatting via Prettier),
 *       .claude/context/stack.md
 *
 * Runs Prettier with --write on the edited file. Silent on success,
 * never blocks. Fails open if Prettier is not installed yet (early
 * sub-phases, before `pnpm install` has run).
 */

import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { readStdinJson, allow, failOpen } from "./lib/io.mjs"
import { toRelative, findAncestor } from "./lib/matchers.mjs"

const HOOK = "post-edit-format"

const FORMAT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".css",
  ".scss",
  ".yml",
  ".yaml",
  ".html",
])

async function main() {
  const input = await readStdinJson()
  if (!input) return allow()

  const tool = input.tool_name
  if (tool !== "Write" && tool !== "Edit") return allow()

  const filePath = input.tool_input?.file_path
  if (typeof filePath !== "string" || filePath.length === 0) return allow()

  const ext = path.extname(filePath).toLowerCase()
  if (!FORMAT_EXTENSIONS.has(ext)) return allow()

  const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const relPath = toRelative(filePath, repoRoot)
  if (!relPath || relPath.startsWith("..")) return allow()

  // Skip generated / vendored trees.
  if (/\/(generated|\.next|dist|build|out|node_modules)\//.test(relPath)) return allow()

  const prettierBin = findPrettier(repoRoot)
  if (!prettierBin) return allow()

  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath)
  if (!fs.existsSync(absolute)) return allow()

  await runPrettier(prettierBin, absolute, repoRoot)
  allow()
}

function findPrettier(repoRoot) {
  const direct = path.join(repoRoot, "node_modules/.bin/prettier")
  if (fs.existsSync(direct)) return direct
  // Walk up in case the hook is invoked in a worktree or a nested package dir.
  const ancestor = findAncestor(repoRoot, "node_modules")
  if (ancestor) {
    const p = path.join(ancestor, "node_modules/.bin/prettier")
    if (fs.existsSync(p)) return p
  }
  return null
}

function runPrettier(bin, file, cwd) {
  return new Promise((resolve) => {
    const proc = spawn(bin, ["--write", "--log-level=silent", file], {
      cwd,
      stdio: "ignore",
    })
    proc.on("exit", () => resolve())
    proc.on("error", () => resolve())
  })
}

main().catch((err) => failOpen(HOOK, err))
