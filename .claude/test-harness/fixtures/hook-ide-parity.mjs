/**
 * Fixture: hook-ide-parity
 * Asserts fail-open when generator script is absent; deny when .claude/
 * rules are staged without corresponding .cursor/rules regeneration.
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

export const name = "hook-ide-parity";
export const description =
  "pre-commit-ide-parity: fail-open + active enforcement";

export async function run() {
  const results = [];
  const scratch = fs.mkdtempSync(
    path.join(process.env.TMPDIR || os.tmpdir(), "forexflow-idep-"),
  );
  try {
    sh(
      scratch,
      "git init -q && git config user.email t@t.io && git config user.name t",
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

    // (A) Generator missing → fail open.
    fs.mkdirSync(path.join(scratch, ".claude/rules"), { recursive: true });
    fs.writeFileSync(
      path.join(scratch, ".claude/rules/01-typescript.md"),
      "# ts\n",
    );
    sh(scratch, "git add .claude/rules/01-typescript.md");
    const failOpen = await runHook(
      "pre-commit-ide-parity.mjs",
      bashPayload('git commit -m "x"'),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(failOpen.parsed), {
        eq: null,
        label: "no generator → allow",
      }),
    );

    // (B) Generator present, rule staged but .cursor/rules/ NOT regenerated → deny.
    fs.mkdirSync(path.join(scratch, "scripts"), { recursive: true });
    fs.writeFileSync(
      path.join(scratch, "scripts/sync-ide-rules.mjs"),
      "// stub\n",
    );
    const denied = await runHook(
      "pre-commit-ide-parity.mjs",
      bashPayload('git commit -m "x"'),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(denied.parsed), {
        eq: "deny",
        label: "rule-without-cursor → deny",
      }),
    );
    results.push(
      expect(reasonFrom(denied.parsed), {
        includes: "ide-parity",
        label: "reason cites hook",
      }),
    );

    // (C) Generator present, both rule AND .cursor file staged → allow.
    fs.mkdirSync(path.join(scratch, ".cursor/rules"), { recursive: true });
    fs.writeFileSync(
      path.join(scratch, ".cursor/rules/01-typescript.mdc"),
      "# ts\n",
    );
    sh(scratch, "git add .cursor/rules/01-typescript.mdc");
    const allowed = await runHook(
      "pre-commit-ide-parity.mjs",
      bashPayload('git commit -m "x"'),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(allowed.parsed), {
        eq: null,
        label: "both staged → allow",
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
