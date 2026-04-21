/**
 * Fixture: hook-no-personal-names
 * Asserts the hook blocks reserved identifiers in ordinary files and
 * allows them in the .github/CODEOWNERS exception; confirms that with
 * no blocklist configured, the hook is a no-op (per ADR #0004).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHook, permissionDecisionFrom } from "../lib/hook-runner.mjs";
import { writePayload } from "../lib/fixture.mjs";
import { expect, combine } from "../lib/assert.mjs";

export const name = "hook-no-personal-names";
export const description =
  "pre-edit-no-personal-names respects blocklist + ALLOWED_PATHS";

export async function run() {
  const results = [];

  const scratchRoot = fs.mkdtempSync(
    path.join(process.env.TMPDIR || os.tmpdir(), "forexflow-nopn-"),
  );
  try {
    // Copy the real .claude/hooks/ and its lib/ into the scratch so the hook
    // runs from the same sources but reads a scratch config.
    const here = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(here, "../../..");
    fs.cpSync(
      path.join(repoRoot, ".claude/hooks"),
      path.join(scratchRoot, ".claude/hooks"),
      {
        recursive: true,
      },
    );

    // Case 1: no blocklist file → hook no-ops (ADR #0004 fail-open).
    const noList = await runHook(
      "pre-edit-no-personal-names.mjs",
      writePayload({
        filePath: "some/file.md",
        content: "Alice Adams says hello",
      }),
      { cwd: scratchRoot },
    );
    results.push(
      expect(permissionDecisionFrom(noList.parsed), {
        eq: null,
        label: "no blocklist → allow",
      }),
    );

    // Case 2: blocklist present; write containing a blocked identifier → deny.
    fs.mkdirSync(path.join(scratchRoot, ".claude/config"), { recursive: true });
    fs.writeFileSync(
      path.join(scratchRoot, ".claude/config/reserved-identifiers.json"),
      JSON.stringify({ identifiers: ["Alice Adams"] }),
      "utf8",
    );
    const blocked = await runHook(
      "pre-edit-no-personal-names.mjs",
      writePayload({
        filePath: "docs/guide.md",
        content: "Alice Adams will onboard you.",
      }),
      { cwd: scratchRoot },
    );
    results.push(
      expect(permissionDecisionFrom(blocked.parsed), {
        eq: "deny",
        label: "blocked identifier → deny",
      }),
    );

    // Case 3: same identifier in .github/CODEOWNERS (ALLOWED_PATHS exception).
    const allowed = await runHook(
      "pre-edit-no-personal-names.mjs",
      writePayload({
        filePath: ".github/CODEOWNERS",
        content: "* @Alice Adams",
      }),
      { cwd: scratchRoot },
    );
    results.push(
      expect(permissionDecisionFrom(allowed.parsed), {
        eq: null,
        label: "CODEOWNERS exception allowed",
      }),
    );
  } finally {
    fs.rmSync(scratchRoot, { recursive: true, force: true });
  }

  return combine(results);
}
