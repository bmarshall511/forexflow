/**
 * Fixture: hook-size-guard
 * Asserts pre-edit-size-guard denies a Write that exceeds the limit for
 * its path class, and allows one within the limit.
 */

import {
  runHook,
  permissionDecisionFrom,
  reasonFrom,
} from "../lib/hook-runner.mjs";
import { writePayload } from "../lib/fixture.mjs";
import { expect, combine } from "../lib/assert.mjs";

export const name = "hook-size-guard";
export const description =
  "pre-edit-size-guard blocks oversized components; allows small ones";

export async function run() {
  const results = [];

  // Web component limit is 150 LOC. A 200-line component should be denied.
  const bigContent = ["import { x } from 'y'"]
    .concat(Array(200).fill("// filler"))
    .join("\n");
  const big = await runHook(
    "pre-edit-size-guard.mjs",
    writePayload({
      filePath: "apps/web/src/components/positions/huge-card.tsx",
      content: bigContent,
    }),
  );
  results.push(expect(big.code, { eq: 0, label: "big write exit code" }));
  results.push(
    expect(permissionDecisionFrom(big.parsed), {
      eq: "deny",
      label: "big write decision",
    }),
  );
  results.push(
    expect(reasonFrom(big.parsed), {
      includes: "pre-edit-size-guard",
      label: "reason cites hook",
    }),
  );

  // A tiny component should pass (no deny).
  const small = await runHook(
    "pre-edit-size-guard.mjs",
    writePayload({
      filePath: "apps/web/src/components/positions/tiny-card.tsx",
      content: "export function TinyCard() { return null }\n",
    }),
  );
  results.push(
    expect(permissionDecisionFrom(small.parsed), {
      eq: null,
      label: "small write decision (should allow)",
    }),
  );

  return combine(results);
}
