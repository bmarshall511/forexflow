#!/usr/bin/env node
/**
 * Hook: pre-edit-plan-required
 * Event: PreToolUse (Write)
 * Rule: .claude/rules/00-foundation.md (plan before code)
 * ADR:  #0002 — fails open when .claude/.session-state/plans/ does not
 *       exist yet, so the hook cannot break itself into life before
 *       post-todowrite-plan-marker has written its first entry.
 * ADR:  #0003 — the marker-file approach backing this check.
 *
 * Blocks a Write that creates a new file longer than ~50 lines unless
 * the agent has recorded a plan in this session. The plan signal is the
 * existence of a TodoWrite-produced marker file under
 * .claude/.session-state/plans/. The stop-session-check hook clears it
 * on exit.
 */

import fs from "node:fs";
import path from "node:path";
import { readStdinJson, allow, deny, failOpen } from "./lib/io.mjs";
import { toRelative } from "./lib/matchers.mjs";
import { countLines } from "./lib/size.mjs";

const HOOK = "pre-edit-plan-required";
const LOC_THRESHOLD = 50;

async function main() {
  const input = await readStdinJson();
  if (!input) return allow();
  if (input.tool_name !== "Write") return allow();

  const filePath = input.tool_input?.file_path;
  if (typeof filePath !== "string" || filePath.length === 0) return allow();

  const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const relPath = toRelative(filePath, repoRoot);
  if (!relPath || relPath.startsWith("..")) return allow();

  // Docs, ADRs, plans, CHANGELOGs, templates — writes are fine without a plan.
  if (isDocumentationPath(relPath)) return allow();

  const projectedLines = countLines(input.tool_input?.content ?? "");
  if (projectedLines <= LOC_THRESHOLD) return allow();

  // Skip entirely if the plan-state directory does not exist (early-phase
  // bootstrapping, before a plan-emitter is wired). This is the fail-open.
  const stateDir = path.join(repoRoot, ".claude/.session-state/plans");
  if (!fs.existsSync(stateDir)) return allow();

  if (hasRecentPlanMarker(stateDir)) return allow();

  deny(
    `Blocked by pre-edit-plan-required: about to Write ${relPath} with ${projectedLines} lines.\n` +
      `\n` +
      `Rule: for any work beyond a trivial fix, record a plan with the TodoWrite\n` +
      `tool before writing new files. Planning first catches scope creep and\n` +
      `keeps commits atomic.\n` +
      `\n` +
      `Fix: invoke TodoWrite with your plan, then retry this Write.\n` +
      `Rule source: .claude/rules/00-foundation.md §1`,
  );
}

function isDocumentationPath(relPath) {
  return (
    relPath.endsWith(".md") ||
    relPath.endsWith(".mdx") ||
    relPath.startsWith(".claude/decisions/") ||
    relPath.startsWith(".claude/plans/") ||
    relPath.startsWith(".claude/journal/") ||
    relPath.startsWith(".claude/handoffs/") ||
    relPath.startsWith("docs/requirements/") ||
    relPath === "CHANGELOG.md" ||
    relPath === ".claude/CHANGELOG.md"
  );
}

function hasRecentPlanMarker(stateDir) {
  try {
    const entries = fs.readdirSync(stateDir);
    // Any file inside counts as a plan recorded this session.
    return entries.length > 0;
  } catch {
    return false;
  }
}

main().catch((err) => failOpen(HOOK, err));
