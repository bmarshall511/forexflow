/**
 * Fixture: hook-plan-required
 * Asserts both states of pre-edit-plan-required:
 *   (a) no state dir  → fail open (ADR #0002)
 *   (b) state dir present, marker present → allow
 *   (c) state dir present, no marker → deny a >50-LOC write
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHook, permissionDecisionFrom } from "../lib/hook-runner.mjs";
import { writePayload } from "../lib/fixture.mjs";
import { expect, combine } from "../lib/assert.mjs";

export const name = "hook-plan-required";
export const description =
  "pre-edit-plan-required: fail-open + allow-with-marker + deny-without-marker";

export async function run() {
  const results = [];

  const scratchRoot = fs.mkdtempSync(
    path.join(process.env.TMPDIR || os.tmpdir(), "forexflow-planreq-"),
  );
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(here, "../../..");
    fs.cpSync(
      path.join(repoRoot, ".claude/hooks"),
      path.join(scratchRoot, ".claude/hooks"),
      {
        recursive: true,
      },
    );

    const bigContent = Array(100).fill("const x = 1").join("\n");

    // (a) No state dir → fail open even on big writes.
    const failOpen = await runHook(
      "pre-edit-plan-required.mjs",
      writePayload({
        filePath: "packages/shared/src/big.ts",
        content: bigContent,
      }),
      { cwd: scratchRoot },
    );
    results.push(
      expect(permissionDecisionFrom(failOpen.parsed), {
        eq: null,
        label: "fail-open when state dir missing",
      }),
    );

    // (b) State dir with marker → allow.
    fs.mkdirSync(path.join(scratchRoot, ".claude/.session-state/plans"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(scratchRoot, ".claude/.session-state/plans/marker.json"),
      "{}",
    );
    const allowed = await runHook(
      "pre-edit-plan-required.mjs",
      writePayload({
        filePath: "packages/shared/src/big2.ts",
        content: bigContent,
      }),
      { cwd: scratchRoot },
    );
    results.push(
      expect(permissionDecisionFrom(allowed.parsed), {
        eq: null,
        label: "marker present → allow",
      }),
    );

    // (c) State dir but empty → deny.
    fs.unlinkSync(
      path.join(scratchRoot, ".claude/.session-state/plans/marker.json"),
    );
    const denied = await runHook(
      "pre-edit-plan-required.mjs",
      writePayload({
        filePath: "packages/shared/src/big3.ts",
        content: bigContent,
      }),
      { cwd: scratchRoot },
    );
    results.push(
      expect(permissionDecisionFrom(denied.parsed), {
        eq: "deny",
        label: "empty state dir + big write → deny",
      }),
    );

    // (d) Small writes always pass regardless of state dir.
    const small = await runHook(
      "pre-edit-plan-required.mjs",
      writePayload({
        filePath: "packages/shared/src/tiny.ts",
        content: "export const x = 1\n",
      }),
      { cwd: scratchRoot },
    );
    results.push(
      expect(permissionDecisionFrom(small.parsed), {
        eq: null,
        label: "small write always allowed",
      }),
    );
  } finally {
    fs.rmSync(scratchRoot, { recursive: true, force: true });
  }

  return combine(results);
}
