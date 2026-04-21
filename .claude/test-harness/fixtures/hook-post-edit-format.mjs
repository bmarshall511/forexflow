// Fixture: hook-post-edit-format
// post-edit-format never denies; it's a silent formatter. The harness
// just confirms exit 0 and no permissionDecision on a .ts Write.

import { runHook, permissionDecisionFrom } from "../lib/hook-runner.mjs";
import { writePayload } from "../lib/fixture.mjs";
import { expect, combine } from "../lib/assert.mjs";

export const name = "hook-post-edit-format";
export const description =
  "post-edit-format never denies, regardless of prettier availability";

export async function run() {
  const results = [];
  const r = await runHook(
    "post-edit-format.mjs",
    writePayload({
      filePath: "packages/shared/src/nothing-real.ts",
      content: "export const x = 1\n",
    }),
  );
  results.push(expect(r.code, { eq: 0, label: "exit code" }));
  results.push(
    expect(permissionDecisionFrom(r.parsed), {
      eq: null,
      label: "no decision (silent)",
    }),
  );
  return combine(results);
}
