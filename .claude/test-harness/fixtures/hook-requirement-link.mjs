// Fixture: hook-requirement-link
// (write-time) pre-edit-requirement-link: fails open when
// docs/requirements/ is absent; once present, blocks new source files
// under apps or packages src trees that lack a @req tag.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHook, permissionDecisionFrom } from "../lib/hook-runner.mjs";
import { writePayload } from "../lib/fixture.mjs";
import { expect, combine } from "../lib/assert.mjs";

export const name = "hook-requirement-link";
export const description =
  "pre-edit-requirement-link: fail-open + active enforcement";

export async function run() {
  const results = [];
  const scratch = fs.mkdtempSync(
    path.join(process.env.TMPDIR || os.tmpdir(), "forexflow-reqlink-"),
  );
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(here, "../../..");
    fs.cpSync(
      path.join(repoRoot, ".claude/hooks"),
      path.join(scratch, ".claude/hooks"),
      {
        recursive: true,
      },
    );

    // (A) docs/requirements/ absent → fail open even on a @req-less source.
    const failOpen = await runHook(
      "pre-edit-requirement-link.mjs",
      writePayload({
        filePath: "packages/shared/src/thing.ts",
        content: "export function thing() {}\n",
      }),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(failOpen.parsed), {
        eq: null,
        label: "no requirements dir → allow",
      }),
    );

    // (B) Directory exists; a @req-less new source → deny.
    fs.mkdirSync(path.join(scratch, "docs/requirements"), { recursive: true });
    const denied = await runHook(
      "pre-edit-requirement-link.mjs",
      writePayload({
        filePath: "packages/shared/src/other.ts",
        content: "export function other() {}\n",
      }),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(denied.parsed), {
        eq: "deny",
        label: "@req-less source → deny",
      }),
    );

    // (C) Same file, content has a @req tag → allow.
    const allowed = await runHook(
      "pre-edit-requirement-link.mjs",
      writePayload({
        filePath: "packages/shared/src/other.ts",
        content: "// @req: REQ-SHARED-001\nexport function other() {}\n",
      }),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(allowed.parsed), {
        eq: null,
        label: "source with @req → allow",
      }),
    );

    // (D) Test file exempt even without @req.
    const testFile = await runHook(
      "pre-edit-requirement-link.mjs",
      writePayload({
        filePath: "packages/shared/src/other.test.ts",
        content: "describe('x', () => {})\n",
      }),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(testFile.parsed), {
        eq: null,
        label: "test file exempt",
      }),
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  return combine(results);
}
