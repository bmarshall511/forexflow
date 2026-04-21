#!/usr/bin/env node
/**
 * Hook: pre-edit-hallucination-guard
 * Event: PreToolUse (Write | Edit)
 * Rule: .claude/rules/00-foundation.md (no guessing),
 *       .claude/rules/01-typescript.md
 *
 * Blocks writes whose local imports cannot be resolved against the repo
 * tree. Does not check external package resolution — that is Node/pnpm's
 * job — only internal imports (relative paths and @forexflow/* scoped
 * package subpaths where the package source exists).
 *
 * Fails open on any uncertainty so it never false-positives during
 * the early rebuild when many packages do not yet exist.
 */

import fs from "node:fs"
import path from "node:path"
import { readStdinJson, allow, deny, failOpen } from "./lib/io.mjs"
import { toRelative } from "./lib/matchers.mjs"
import {
  extractImports,
  isLocalSpecifier,
  isWorkspaceSpecifier,
  parseWorkspaceSpecifier,
} from "./lib/imports.mjs"

const HOOK = "pre-edit-hallucination-guard"

const RESOLVE_EXTS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"]

async function main() {
  const input = await readStdinJson()
  if (!input) return allow()

  const tool = input.tool_name
  if (tool !== "Write" && tool !== "Edit") return allow()

  const filePath = input.tool_input?.file_path
  if (typeof filePath !== "string" || filePath.length === 0) return allow()
  if (!/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(filePath)) return allow()

  const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const relPath = toRelative(filePath, repoRoot)
  if (!relPath || relPath.startsWith("..")) return allow()

  const content = projectedContent(filePath, tool, input.tool_input)
  if (content === null) return allow()

  const absFile = path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath)
  const fromDir = path.dirname(absFile)

  for (const spec of extractImports(content)) {
    if (isLocalSpecifier(spec)) {
      const abs = path.resolve(fromDir, spec)
      if (!resolveExists(abs)) {
        deny(
          `Blocked by pre-edit-hallucination-guard: ${relPath}\n` +
            `  unresolved import: ${spec}\n` +
            `  searched: ${path.relative(repoRoot, abs) || "./"}\n` +
            `\nFix: make sure the imported file exists, or remove the import.\n` +
            `Rule: .claude/rules/00-foundation.md`,
        )
        return
      }
      continue
    }

    if (isWorkspaceSpecifier(spec)) {
      const parsed = parseWorkspaceSpecifier(spec)
      if (!parsed) continue
      const pkgDir = path.join(repoRoot, "packages", parsed.pkg.replace(/^@forexflow\//, ""))
      // If the package does not yet exist in the tree, skip — early-phase code
      // can reference a package that will be created in a later sub-phase. We
      // prefer fail-open here and rely on tsc / review agents to catch truly
      // missing workspace dependencies.
      if (!fs.existsSync(pkgDir)) continue
      if (parsed.subpath) {
        const abs = path.join(pkgDir, "src", parsed.subpath)
        if (!resolveExists(abs) && !resolveExists(path.join(pkgDir, parsed.subpath))) {
          deny(
            `Blocked by pre-edit-hallucination-guard: ${relPath}\n` +
              `  unresolved workspace import: ${spec}\n` +
              `  package: ${parsed.pkg} exists at ${path.relative(repoRoot, pkgDir)}/\n` +
              `  sub-path not found: ${parsed.subpath}\n` +
              `\nRule: .claude/rules/00-foundation.md`,
          )
          return
        }
      }
    }
  }

  allow()
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

function resolveExists(baseAbs) {
  // Direct hit
  if (fs.existsSync(baseAbs) && fs.statSync(baseAbs).isFile()) return true
  // With each extension
  for (const ext of RESOLVE_EXTS) {
    if (fs.existsSync(baseAbs + ext) && fs.statSync(baseAbs + ext).isFile()) return true
  }
  // Index file inside a directory
  if (fs.existsSync(baseAbs) && fs.statSync(baseAbs).isDirectory()) {
    for (const ext of RESOLVE_EXTS) {
      const idx = path.join(baseAbs, "index" + ext)
      if (fs.existsSync(idx)) return true
    }
  }
  return false
}

main().catch((err) => failOpen(HOOK, err))
