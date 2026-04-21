/**
 * Fixture: hook-requirements-sync
 * Asserts fail-open when docs/requirements/ is absent, and block-when-
 * feat-lacks-@req once the directory exists and the staged source has
 * no @req tag and the commit message has none.
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

export const name = "hook-requirements-sync";
export const description =
  "pre-commit-requirements-sync: fail-open + active enforcement";

export async function run() {
  const results = [];
  const scratch = fs.mkdtempSync(
    path.join(process.env.TMPDIR || os.tmpdir(), "forexflow-req-"),
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

    // (A) No docs/requirements/ → fail open even for feat().
    fs.mkdirSync(path.join(scratch, "packages/shared/src"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(scratch, "packages/shared/src/a.ts"),
      "export const x = 1\n",
    );
    sh(scratch, "git add packages/shared/src/a.ts");
    const failOpen = await runHook(
      "pre-commit-requirements-sync.mjs",
      bashPayload('git commit -m "feat(shared): a"'),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(failOpen.parsed), {
        eq: null,
        label: "no requirements dir → allow",
      }),
    );
    sh(
      scratch,
      "git reset HEAD packages/shared/src/a.ts && rm packages/shared/src/a.ts",
    );

    // (B) Directory exists; feat commit with no @req anywhere → deny.
    fs.mkdirSync(path.join(scratch, "docs/requirements"), { recursive: true });
    fs.writeFileSync(path.join(scratch, "docs/requirements/.gitkeep"), "");
    sh(scratch, "git add docs/requirements && git commit -q -m baseline");

    fs.writeFileSync(
      path.join(scratch, "packages/shared/src/b.ts"),
      "export const y = 2\n",
    );
    sh(scratch, "git add packages/shared/src/b.ts");
    const blocked = await runHook(
      "pre-commit-requirements-sync.mjs",
      bashPayload('git commit -m "feat(shared): b"'),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(blocked.parsed), {
        eq: "deny",
        label: "feat without @req → deny",
      }),
    );
    results.push(
      expect(reasonFrom(blocked.parsed), {
        includes: "requirements-sync",
        label: "reason cites hook",
      }),
    );

    // (C) Same staged file, but commit footer has @req → allow.
    const withReq = await runHook(
      "pre-commit-requirements-sync.mjs",
      bashPayload(`git commit -m 'feat(shared): b\n\n@req: REQ-SHARED-001'`),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(withReq.parsed), {
        eq: null,
        label: "feat with @req footer → allow",
      }),
    );

    // (D) chore() commits never require a @req.
    const chore = await runHook(
      "pre-commit-requirements-sync.mjs",
      bashPayload('git commit -m "chore: tidy"'),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(chore.parsed), {
        eq: null,
        label: "chore exempt",
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
