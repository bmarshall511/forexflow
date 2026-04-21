#!/usr/bin/env node
/**
 * Hook: pre-edit-import-boundary
 * Event: PreToolUse (Write | Edit)
 * Rule: .claude/rules/06-monorepo-boundaries.md
 *
 * Blocks cross-app imports, package-depends-on-app imports, and imports
 * outside a package's declared allowed dependency set. Boundary graph
 * lives in .claude/config/import-boundary-graph.json (single source of
 * truth, consumed by both this hook and tooling).
 */

import fs from "node:fs"
import path from "node:path"
import { readStdinJson, allow, deny, failOpen } from "./lib/io.mjs"
import { toRelative } from "./lib/matchers.mjs"
import {
  extractImports,
  isWorkspaceSpecifier,
  isLocalSpecifier,
  parseWorkspaceSpecifier,
  classifyPath,
} from "./lib/imports.mjs"

const HOOK = "pre-edit-import-boundary"

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

  // Only inspect source files under apps/ or packages/.
  const origin = classifyPath(relPath)
  if (origin.kind === "other") return allow()
  if (!/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(relPath)) return allow()

  const projected = projectedContent(filePath, tool, input.tool_input)
  if (projected === null) return allow()

  const graph = loadGraph(repoRoot)
  const specifiers = extractImports(projected)

  for (const spec of specifiers) {
    const violation = classifyImport(spec, origin, relPath, graph)
    if (violation) {
      deny(
        `Blocked by pre-edit-import-boundary: ${relPath}\n` +
          `  import: ${spec}\n` +
          `  reason: ${violation}\n` +
          `\nRule: .claude/rules/06-monorepo-boundaries.md`,
      )
      return
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

function classifyImport(spec, origin, relPath, graph) {
  if (isWorkspaceSpecifier(spec)) {
    const parsed = parseWorkspaceSpecifier(spec)
    if (!parsed) return null
    const importedPkg = shortName(parsed.pkg)
    if (origin.kind === "package") {
      const allowed = graph.packages[origin.name] || []
      if (importedPkg !== origin.name && !allowed.includes(importedPkg)) {
        return `package '${origin.name}' is not allowed to import '${parsed.pkg}'`
      }
    }
    return null
  }

  if (isLocalSpecifier(spec)) {
    const fromAbs = path.dirname(path.join("/__root__", relPath))
    const targetRel = path
      .normalize(path.join(fromAbs, spec))
      .replace(/^\/__root__\/?/, "")
      .split(path.sep)
      .join("/")

    const target = classifyPath(targetRel)
    if (target.kind === "other") return null

    if (origin.kind === "package" && target.kind === "app") {
      return "packages must never import from apps"
    }
    if (origin.kind === "app" && target.kind === "app" && origin.name !== target.name) {
      return `app '${origin.name}' cannot import from app '${target.name}'`
    }
    if (origin.kind === "package" && target.kind === "package" && origin.name !== target.name) {
      const allowed = graph.packages[origin.name] || []
      if (!allowed.includes(target.name)) {
        return `package '${origin.name}' is not allowed to import from package '${target.name}'`
      }
    }
    return null
  }

  return null
}

function shortName(pkg) {
  return pkg.replace(/^@forexflow\//, "")
}

function loadGraph(repoRoot) {
  try {
    const p = path.join(repoRoot, ".claude/config/import-boundary-graph.json")
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf8")
      const parsed = JSON.parse(raw)
      if (parsed?.packages) return parsed
    }
  } catch {
    // fall through
  }
  return {
    packages: {
      types: [],
      shared: ["types"],
      config: ["types"],
      logger: ["types"],
      db: ["types", "shared", "config", "logger"],
    },
  }
}

main().catch((err) => failOpen(HOOK, err))
