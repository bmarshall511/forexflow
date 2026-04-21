/**
 * Fixture: hook-docs-sync
 * Asserts fail-open when doc-map is absent/empty, and block-on-commit
 * when a mapped file is staged without the required doc update.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runHook,
  permissionDecisionFrom,
  reasonFrom,
} from "../lib/hook-runner.mjs";
import { bashPayload } from "../lib/fixture.mjs";
import { expect, combine } from "../lib/assert.mjs";

export const name = "hook-docs-sync";
export const description =
  "pre-commit-docs-sync: fail-open + active enforcement";

export async function run() {
  const results = [];
  const scratch = fs.mkdtempSync(
    path.join(process.env.TMPDIR || os.tmpdir(), "forexflow-docs-"),
  );
  try {
    sh(scratch, "git init -q");
    sh(
      scratch,
      "git config user.email test@example.com && git config user.name test",
    );
    fs.writeFileSync(path.join(scratch, "seed"), "x");
    sh(scratch, "git add seed && git commit -q -m seed");

    const here = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(here, "../../..");
    fs.cpSync(
      path.join(repoRoot, ".claude/hooks"),
      path.join(scratch, ".claude/hooks"),
      {
        recursive: true,
      },
    );

    // Case A: no doc-map → fail open.
    fs.writeFileSync(path.join(scratch, "new-rule.md"), "hi");
    sh(scratch, "git add new-rule.md");
    const failOpen = await runHook(
      "pre-commit-docs-sync.mjs",
      bashPayload('git commit -m "x"'),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(failOpen.parsed), {
        eq: null,
        label: "no doc-map → allow",
      }),
    );
    sh(scratch, "git reset HEAD new-rule.md && rm new-rule.md");

    // Case B: doc-map configured, add a new rule file without updating the doc.
    fs.mkdirSync(path.join(scratch, ".claude/config"), { recursive: true });
    fs.mkdirSync(path.join(scratch, ".claude/rules"), { recursive: true });
    fs.writeFileSync(
      path.join(scratch, ".claude/config/doc-map.json"),
      JSON.stringify({
        entries: [
          {
            pattern: ".claude/rules/*.md",
            docs: [".claude/README.md"],
            label: "agent rules",
          },
        ],
      }),
    );
    // Baseline: a stubbed .claude/README.md exists and is committed.
    fs.writeFileSync(path.join(scratch, ".claude/README.md"), "# readme\n");
    sh(
      scratch,
      "git add .claude/README.md .claude/config/doc-map.json && git commit -q -m baseline",
    );

    // Now add a new rule file; do not stage README.md.
    fs.writeFileSync(
      path.join(scratch, ".claude/rules/00-foundation.md"),
      "# foundation\n",
    );
    sh(scratch, "git add .claude/rules/00-foundation.md");
    const blocked = await runHook(
      "pre-commit-docs-sync.mjs",
      bashPayload('git commit -m "x"'),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(blocked.parsed), {
        eq: "deny",
        label: "unstaged doc → deny",
      }),
    );
    results.push(
      expect(reasonFrom(blocked.parsed), {
        includes: "docs-sync",
        label: "reason cites hook",
      }),
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  return combine(results);
}

function sh(cwd, cmd) {
  const r = spawnSync("sh", ["-c", cmd], { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`sh failed (${cmd}): ${r.stderr}`);
}
