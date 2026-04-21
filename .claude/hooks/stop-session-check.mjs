#!/usr/bin/env node
/**
 * Hook: stop-session-check
 * Event: Stop
 * Rule: .claude/rules/10-git-workflow.md §"Continuous green"
 *
 * Runs a lightweight typecheck + uncommitted-changes summary at session
 * end. Informational only. Never blocks. Fails open on any error.
 *
 * Emits a `systemMessage` per the Claude Code Stop hook schema so the
 * user sees a concise status at the end of the session.
 */

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { readStdinJson, failOpen } from "./lib/io.mjs";

const HOOK = "stop-session-check";

async function main() {
  await readStdinJson(); // drain stdin even if unused

  const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const parts = [];

  parts.push(gitSummary(repoRoot));
  parts.push(typecheckSummary(repoRoot));
  cleanSessionState(repoRoot);

  const message = parts.filter(Boolean).join("\n");
  emit(message);
}

/**
 * Clear the per-session plan-marker directory so the next session starts
 * without inherited state. See ADR #0003.
 */
function cleanSessionState(repoRoot) {
  const plansDir = path.join(repoRoot, ".claude/.session-state/plans");
  try {
    if (fs.existsSync(plansDir)) {
      for (const entry of fs.readdirSync(plansDir)) {
        try {
          fs.unlinkSync(path.join(plansDir, entry));
        } catch {
          // Ignore individual file failures; best-effort cleanup.
        }
      }
    }
  } catch {
    // Fail open; a crashed-and-resumed session inheriting a stale marker
    // only relaxes enforcement, not tightens it.
  }
}

function gitSummary(repoRoot) {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const staged = execSync("git diff --cached --name-only", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .filter(Boolean).length;
    const unstaged = execSync("git diff --name-only", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .filter(Boolean).length;

    const bits = [`Branch: ${branch}`];
    if (staged > 0) bits.push(`${staged} staged file(s)`);
    if (unstaged > 0) bits.push(`${unstaged} unstaged change(s)`);
    return bits.join(" · ");
  } catch {
    return "";
  }
}

function typecheckSummary(repoRoot) {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
    );
    if (!pkg.scripts || typeof pkg.scripts.typecheck !== "string") return "";

    const pnpmCheck = spawnSync("pnpm", ["--version"], {
      cwd: repoRoot,
      stdio: "ignore",
    });
    if (pnpmCheck.status !== 0) return "";

    const result = spawnSync("sh", ["-c", "pnpm typecheck"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status === 0) return "Typecheck: PASS";
    const errorLines = (result.stdout + "\n" + result.stderr)
      .split("\n")
      .filter((l) => /error TS\d+/.test(l))
      .slice(0, 5)
      .join("\n");
    return `Typecheck: FAIL\n${errorLines}`;
  } catch {
    return "";
  }
}

function emit(message) {
  process.stdout.write(
    JSON.stringify({
      systemMessage: message || "Session end: no status available",
      suppressOutput: false,
    }) + "\n",
  );
  process.exit(0);
}

main().catch((err) => failOpen(HOOK, err));
