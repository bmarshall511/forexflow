/**
 * Fixture: hook-no-any
 * Asserts pre-edit-no-any blocks `: any` without TODO and allows it with TODO.
 */

import {
  runHook,
  permissionDecisionFrom,
  reasonFrom,
} from "../lib/hook-runner.mjs";
import { writePayload } from "../lib/fixture.mjs";
import { expect, combine } from "../lib/assert.mjs";

export const name = "hook-no-any";
export const description =
  "pre-edit-no-any blocks unjustified any; allows TODO-annotated";

export async function run() {
  const results = [];

  const bad = await runHook(
    "pre-edit-no-any.mjs",
    writePayload({
      filePath: "packages/shared/src/bad.ts",
      content: `export function danger(x: any) { return x }\n`,
    }),
  );
  results.push(
    expect(permissionDecisionFrom(bad.parsed), {
      eq: "deny",
      label: "unjustified any decision",
    }),
  );
  results.push(
    expect(reasonFrom(bad.parsed), {
      includes: "any",
      label: "reason mentions any",
    }),
  );

  const good = await runHook(
    "pre-edit-no-any.mjs",
    writePayload({
      filePath: "packages/shared/src/good.ts",
      content:
        `// TODO(type): upstream lib types are broken; revisit after #42\n` +
        `export function safe(x: any) { return x }\n`,
    }),
  );
  results.push(
    expect(permissionDecisionFrom(good.parsed), {
      eq: null,
      label: "TODO-justified any allowed",
    }),
  );

  // Strings containing "any" must not false-positive.
  const stringy = await runHook(
    "pre-edit-no-any.mjs",
    writePayload({
      filePath: "packages/shared/src/stringy.ts",
      content: `export const label = "any widget"\nexport const ns = ":anywhere"\n`,
    }),
  );
  results.push(
    expect(permissionDecisionFrom(stringy.parsed), {
      eq: null,
      label: "string containing any should not false-positive",
    }),
  );

  return combine(results);
}
