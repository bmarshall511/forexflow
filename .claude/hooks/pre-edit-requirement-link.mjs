#!/usr/bin/env node
/**
 * Hook: pre-edit-requirement-link
 * Event: PreToolUse (Write | Edit)
 * Rule: .claude/rules/14-requirements-traceability.md
 * ADR:  #0002 — fails open when docs/requirements/ does not yet exist.
 *       Activates as soon as Sub-phase 10 scaffolds the directory.
 *
 * For new source files under apps/** or packages/**, verifies that the
 * content contains at least one @req: REQ-*-### tag, OR that a sibling
 * requirement file is being edited in the same session, OR that a
 * placeholder commit mode is active. Fails open on test and config
 * files (other rules handle those).
 */

import fs from "node:fs";
import path from "node:path";
import { readStdinJson, allow, deny, failOpen } from "./lib/io.mjs";
import { toRelative } from "./lib/matchers.mjs";

const HOOK = "pre-edit-requirement-link";
const REQ_TAG_RE = /@req:\s*REQ-[A-Z][A-Z0-9-]*-\d{1,4}/;

async function main() {
  const input = await readStdinJson();
  if (!input) return allow();

  const tool = input.tool_name;
  if (tool !== "Write" && tool !== "Edit") return allow();

  const filePath = input.tool_input?.file_path;
  if (typeof filePath !== "string" || filePath.length === 0) return allow();

  const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const relPath = toRelative(filePath, repoRoot);
  if (!relPath || relPath.startsWith("..")) return allow();

  // Fail open if requirements scaffolding is not yet in place.
  if (!fs.existsSync(path.join(repoRoot, "docs/requirements"))) return allow();

  // Scope: only source files under apps/**/src or packages/**/src.
  if (!/^(apps|packages)\/[^/]+\/src\//.test(relPath)) return allow();
  if (!/\.(ts|tsx)$/.test(relPath)) return allow();

  // Exempt: tests, stories, fixtures, generated.
  if (
    /\.(test|spec|contract\.test|visual\.spec|bench)\.(ts|tsx)$/.test(relPath)
  )
    return allow();
  if (/\/(generated|__fixtures__|__tests__|__mocks__)\//.test(relPath))
    return allow();

  // For Edit tool, only enforce on genuinely new content — adding a function
  // that declares a new public entry point. We approximate "genuinely new" by
  // checking whether the projected content includes any `export` that the
  // current file does not. Imperfect; fails open on uncertainty.
  const beforeExports = currentExports(filePath);
  const projected = projectedContent(filePath, tool, input.tool_input);
  if (projected === null) return allow();
  const afterExports = extractExports(projected);
  const newExports = afterExports.filter((e) => !beforeExports.has(e));

  // No new exports introduced? Nothing to enforce.
  if (tool === "Edit" && newExports.length === 0) return allow();

  if (REQ_TAG_RE.test(projected)) return allow();

  deny(
    `Blocked by pre-edit-requirement-link: ${relPath}\n` +
      `\n` +
      `New source file${newExports.length ? " or new exported symbol" : ""} has no\n` +
      `"@req: REQ-*-###" tag.\n` +
      `\n` +
      `Every feature-bearing source file must link to a requirement in\n` +
      `docs/requirements/. Options:\n` +
      `\n` +
      `  1. Add a comment near the relevant export:\n` +
      `     // @req: REQ-TRADING-014\n` +
      `  2. Create the requirement first at\n` +
      `     docs/requirements/<scope>/<number>-<slug>.md\n` +
      `  3. If this is infrastructure (not a user-facing behavior), link\n` +
      `     to the infrastructure requirement (REQ-REPO-001 or similar).\n` +
      `\n` +
      `Rule: .claude/rules/14-requirements-traceability.md`,
  );
}

function projectedContent(filePath, tool, toolInput) {
  try {
    if (tool === "Write") return toolInput?.content ?? "";
    const absolute = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(absolute)) return null;
    const current = fs.readFileSync(absolute, "utf8");
    const {
      old_string: oldStr,
      new_string: newStr,
      replace_all,
    } = toolInput || {};
    if (typeof oldStr !== "string" || typeof newStr !== "string") return null;
    if (oldStr === "") return current;
    return replace_all
      ? current.split(oldStr).join(newStr)
      : current.replace(oldStr, newStr);
  } catch {
    return null;
  }
}

function currentExports(filePath) {
  try {
    const absolute = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(absolute)) return new Set();
    const current = fs.readFileSync(absolute, "utf8");
    return new Set(extractExports(current));
  } catch {
    return new Set();
  }
}

function extractExports(content) {
  const out = [];
  const re =
    /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
  let m;
  while ((m = re.exec(content)) !== null) out.push(m[1]);
  return out;
}

main().catch((err) => failOpen(HOOK, err));
