#!/usr/bin/env node
/**
 * Hook: post-todowrite-plan-marker
 * Event: PostToolUse (TodoWrite)
 * Rule: .claude/rules/00-foundation.md §1 (plan before code)
 * ADR: .claude/decisions/0003-todowrite-plan-marker.md
 *
 * Writes a small marker file to .claude/.session-state/plans/ every
 * time the agent invokes TodoWrite. The pre-edit-plan-required hook
 * checks for any file in that directory to decide whether the session
 * has recorded a plan. stop-session-check cleans the directory on exit.
 *
 * The marker contents are not consumed by the checker — only its
 * presence matters. The payload exists for forensic use (failure-mode
 * cataloging, debug sessions).
 */

import fs from "node:fs";
import path from "node:path";
import { readStdinJson, allow, failOpen } from "./lib/io.mjs";

const HOOK = "post-todowrite-plan-marker";

async function main() {
  const input = await readStdinJson();
  if (!input) return allow();
  if (input.tool_name !== "TodoWrite") return allow();

  const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const stateDir = path.join(repoRoot, ".claude/.session-state/plans");

  try {
    fs.mkdirSync(stateDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const target = path.join(stateDir, `${stamp}.json`);
    const body = {
      ts: new Date().toISOString(),
      session: process.env.CLAUDE_SESSION_ID || null,
      todoCount: Array.isArray(input.tool_input?.todos)
        ? input.tool_input.todos.length
        : null,
    };
    fs.writeFileSync(target, JSON.stringify(body, null, 2) + "\n", "utf8");
  } catch {
    // Fail open — a plan-marker that can't be written should not stop the
    // user. The pre-edit-plan-required hook independently fails open when
    // the state dir is missing, so no cascade here.
  }

  allow();
}

main().catch((err) => failOpen(HOOK, err));
