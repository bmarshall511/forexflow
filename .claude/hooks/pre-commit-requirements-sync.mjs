#!/usr/bin/env node
/**
 * Hook: pre-commit-requirements-sync
 * Event: PreToolUse (Bash, on `git commit`)
 * Rule: .claude/rules/14-requirements-traceability.md
 * ADR:  #0002 — fails open when docs/requirements/ does not yet exist.
 *       Activates as soon as Sub-phase 10 scaffolds the directory.
 *
 * For feat() / fix() / perf() commits, ensures either:
 *   - a requirement file in docs/requirements/ is also staged, or
 *   - at least one staged source file references an existing @req tag, or
 *   - the commit message footer contains "@req: REQ-*-*"
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { readStdinJson, allow, deny, failOpen } from "./lib/io.mjs";

const HOOK = "pre-commit-requirements-sync";
const REQ_TAG_RE = /@req:\s*(REQ-[A-Z][A-Z0-9-]*-\d{1,4})/g;
const ENFORCED_TYPES = new Set(["feat", "fix", "perf"]);

async function main() {
  const input = await readStdinJson();
  if (!input || input.tool_name !== "Bash") return allow();

  const cmd = input.tool_input?.command ?? "";
  if (!/\bgit\s+commit\b/.test(cmd)) return allow();

  const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  // Fail open if requirements scaffolding is not in place.
  if (!fs.existsSync(path.join(repoRoot, "docs/requirements"))) return allow();

  const commitMessage = extractCommitMessage(cmd, repoRoot);
  if (commitMessage === null) return allow();
  const commitType = extractCommitType(commitMessage);
  if (!ENFORCED_TYPES.has(commitType)) return allow();

  const stagedFiles = stagedPaths(repoRoot);
  if (stagedFiles.length === 0) return allow();

  // (a) A requirement file is being staged alongside the change.
  if (
    stagedFiles.some(
      (p) => p.startsWith("docs/requirements/") && p.endsWith(".md"),
    )
  ) {
    return allow();
  }

  // (b) The commit message footer references a requirement.
  if (REQ_TAG_RE.test(commitMessage)) return allow();

  // (c) At least one source file under apps/ or packages/ contains a @req tag.
  const sourceFiles = stagedFiles.filter(
    (p) =>
      /^(apps|packages)\/[^/]+\/src\//.test(p) &&
      /\.(ts|tsx)$/.test(p) &&
      !/\.(test|spec|contract\.test|visual\.spec|bench)\./.test(p),
  );
  for (const file of sourceFiles) {
    const content = safeRead(path.join(repoRoot, file));
    if (content && REQ_TAG_RE.test(content)) return allow();
  }

  deny(
    `Blocked by pre-commit-requirements-sync: a ${commitType}() commit has no requirement link.\n\n` +
      `Every feat/fix/perf commit must either:\n` +
      `  1. Stage a new or updated requirement in docs/requirements/\n` +
      `  2. Reference an existing requirement via a @req: REQ-*-* tag in at least\n` +
      `     one staged source file, or\n` +
      `  3. Reference a requirement in the commit message footer:\n` +
      `        @req: REQ-TRADING-014\n` +
      `\n` +
      `Rule: .claude/rules/14-requirements-traceability.md`,
  );
}

function extractCommitMessage(cmd, repoRoot) {
  // Handle -m, -F/--file, --message, and heredoc patterns reasonably.
  // If the message is not obviously extractable, fall back to reading
  // .git/COMMIT_EDITMSG after git's pre-commit chain would normally run.

  // -m "..." or --message="..."
  const m = cmd.match(
    /\s-(?:m\s+|-message(?:=|\s+))(?:'([\s\S]*?)'|"([\s\S]*?)"|(\S+))/,
  );
  if (m) return m[1] ?? m[2] ?? m[3] ?? "";

  // -F / --file <path>
  const f = cmd.match(/\s--?F(?:ile)?\s+(\S+)/);
  if (f) {
    const content = safeRead(path.join(repoRoot, f[1]));
    if (content !== null) return content;
  }

  // Heredoc pattern: git commit -m "$(cat <<'EOF' ... EOF\n)"
  const heredoc = cmd.match(/<<['"]?EOF['"]?\n([\s\S]*?)\nEOF/);
  if (heredoc) return heredoc[1];

  // Fallback: COMMIT_EDITMSG (may not exist until the commit is already
  // in progress; that's fine — we fail open).
  const p = path.join(repoRoot, ".git/COMMIT_EDITMSG");
  return safeRead(p);
}

function extractCommitType(message) {
  const m = message.match(/^([a-z]+)(?:\([^)]+\))?!?:/);
  return m ? m[1] : "";
}

function stagedPaths(repoRoot) {
  try {
    const out = execSync("git diff --cached --name-only --no-color", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 10 * 1024 * 1024,
    });
    return out.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function safeRead(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

main().catch((err) => failOpen(HOOK, err));
