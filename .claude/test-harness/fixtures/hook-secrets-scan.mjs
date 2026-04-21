/**
 * Fixture: hook-secrets-scan
 * Exercises the regex fallback by seeding a scratch git repo with a
 * staged diff containing a synthetic Anthropic-style token, then
 * invoking the hook with a "git commit" bash payload.
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

export const name = "hook-secrets-scan";
export const description =
  "pre-commit-secrets-scan blocks staged diff containing credential patterns";

export async function run() {
  const results = [];
  const scratch = fs.mkdtempSync(
    path.join(process.env.TMPDIR || os.tmpdir(), "forexflow-secrets-"),
  );
  try {
    // Initialize a scratch git repo.
    sh(scratch, "git init -q");
    sh(scratch, "git config user.email test@example.com");
    sh(scratch, "git config user.name test");
    fs.writeFileSync(path.join(scratch, "seed.txt"), "seed\n");
    sh(scratch, "git add seed.txt");
    sh(scratch, "git commit -q -m seed");

    // Copy our hook + lib into the scratch so it resolves its imports.
    const here = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(here, "../../..");
    fs.cpSync(
      path.join(repoRoot, ".claude/hooks"),
      path.join(scratch, ".claude/hooks"),
      {
        recursive: true,
      },
    );

    // Stage a file containing a synthetic Anthropic-style token.
    const syntheticToken = "sk-ant-" + "A".repeat(60);
    fs.writeFileSync(
      path.join(scratch, "leak.ts"),
      `const key = "${syntheticToken}"\n`,
    );
    sh(scratch, "git add leak.ts");

    // Invoke the hook with a git commit command and the scratch as cwd.
    const bad = await runHook(
      "pre-commit-secrets-scan.mjs",
      bashPayload('git commit -m "test"'),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(bad.parsed), {
        eq: "deny",
        label: "leaked token denied",
      }),
    );
    results.push(
      expect(reasonFrom(bad.parsed), {
        includes: "secrets-scan",
        label: "reason cites hook",
      }),
    );

    // Clean: unstage + remove leak, stage a clean file. Hook should allow.
    sh(scratch, "git reset HEAD leak.ts");
    fs.unlinkSync(path.join(scratch, "leak.ts"));
    fs.writeFileSync(path.join(scratch, "clean.ts"), "export const x = 1\n");
    sh(scratch, "git add clean.ts");

    const clean = await runHook(
      "pre-commit-secrets-scan.mjs",
      bashPayload('git commit -m "test"'),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(clean.parsed), {
        eq: null,
        label: "clean diff allowed",
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
