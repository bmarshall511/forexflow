/**
 * Fixture: hook-continuous-green
 * Fail-open when package.json is absent or lacks typecheck/lint/test scripts.
 * Full activation (script-failing → deny) is covered indirectly: verifying
 * the fail-open branch here is sufficient for Phase 1 since no scripts
 * exist yet. Full coverage lands alongside Phase 2 scripts.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runHook, permissionDecisionFrom } from "../lib/hook-runner.mjs";
import { bashPayload } from "../lib/fixture.mjs";
import { expect, combine } from "../lib/assert.mjs";

export const name = "hook-continuous-green";
export const description =
  "pre-commit-continuous-green fails open pre-Phase-2 (no scripts yet)";

export async function run() {
  const results = [];
  const scratch = fs.mkdtempSync(
    path.join(process.env.TMPDIR || os.tmpdir(), "forexflow-green-"),
  );
  try {
    // (A) No package.json → fail open.
    const noPkg = await runHook(
      "pre-commit-continuous-green.mjs",
      bashPayload('git commit -m "x"'),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(noPkg.parsed), {
        eq: null,
        label: "no package.json → allow",
      }),
    );

    // (B) package.json exists but no script fields → fail open.
    fs.writeFileSync(
      path.join(scratch, "package.json"),
      JSON.stringify({ name: "test", scripts: {} }),
    );
    const noScripts = await runHook(
      "pre-commit-continuous-green.mjs",
      bashPayload('git commit -m "x"'),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(noScripts.parsed), {
        eq: null,
        label: "no scripts → allow",
      }),
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  return combine(results);
}
