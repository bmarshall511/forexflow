#!/usr/bin/env node
/**
 * Hook: pre-commit-continuous-green
 * Event: PreToolUse (Bash, on `git commit`)
 * Rule: .claude/rules/10-git-workflow.md §"Continuous green"
 * ADR:  #0002 — fails open when package.json lacks typecheck/lint/test
 *       scripts or when pnpm is not on PATH. Activates automatically
 *       as soon as Phase 2 lands the scripts.
 *
 * Runs typecheck, lint, and test on the staged tree before letting the
 * commit land. When all three scripts are present, any failure blocks.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { readStdinJson, allow, deny, failOpen } from "./lib/io.mjs";

const HOOK = "pre-commit-continuous-green";

async function main() {
  const input = await readStdinJson();
  if (!input || input.tool_name !== "Bash") return allow();

  const cmd = input.tool_input?.command ?? "";
  if (!/\bgit\s+commit\b/.test(cmd)) return allow();

  const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const pkgJson = safeReadJson(path.join(repoRoot, "package.json"));
  if (!pkgJson) return allow();

  const scripts = pkgJson.scripts ?? {};
  const toRun = [
    { name: "typecheck", cmd: "pnpm typecheck" },
    { name: "lint", cmd: "pnpm lint" },
    { name: "test", cmd: "pnpm test" },
  ].filter(
    (s) => typeof scripts[s.name] === "string" && scripts[s.name].length > 0,
  );

  if (toRun.length === 0) return allow();

  // If pnpm is not on PATH, fail open — the environment is not ready.
  const pnpmCheck = spawnSync("pnpm", ["--version"], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  if (pnpmCheck.status !== 0) return allow();

  for (const { name, cmd: scriptCmd } of toRun) {
    const result = spawnSync("sh", ["-c", scriptCmd], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status !== 0) {
      const tail = tailLines(result.stdout + "\n" + result.stderr, 20);
      deny(
        `Blocked by pre-commit-continuous-green: '${name}' failed.\n\n` +
          `Command: ${scriptCmd}\n\n` +
          `Last output:\n${tail}\n\n` +
          `Rule: every commit must leave the tree typecheck-clean, lint-clean,\n` +
          `and test-clean. Fix the failure, re-stage if needed, retry commit.\n` +
          `\n` +
          `Rule: .claude/rules/10-git-workflow.md`,
      );
      return;
    }
  }

  allow();
}

function safeReadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function tailLines(s, n) {
  const lines = s.split("\n");
  return lines.slice(-n).join("\n");
}

main().catch((err) => failOpen(HOOK, err));
