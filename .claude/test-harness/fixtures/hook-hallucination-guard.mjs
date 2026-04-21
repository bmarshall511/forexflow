/**
 * Fixture: hook-hallucination-guard
 * Asserts unresolved local imports are blocked; resolvable ones pass.
 */

import {
  runHook,
  permissionDecisionFrom,
  reasonFrom,
} from "../lib/hook-runner.mjs";
import { writePayload } from "../lib/fixture.mjs";
import { expect, combine } from "../lib/assert.mjs";

export const name = "hook-hallucination-guard";
export const description =
  "pre-edit-hallucination-guard blocks unresolvable local imports";

export async function run() {
  const results = [];

  // Unresolvable local import — filename definitely doesn't exist.
  const bad = await runHook(
    "pre-edit-hallucination-guard.mjs",
    writePayload({
      filePath: "packages/shared/src/caller.ts",
      content: `import { x } from "./definitely-does-not-exist-xyz"\n`,
    }),
  );
  results.push(
    expect(permissionDecisionFrom(bad.parsed), {
      eq: "deny",
      label: "unresolved import denied",
    }),
  );
  results.push(
    expect(reasonFrom(bad.parsed), {
      includes: "hallucination-guard",
      label: "reason cites hook",
    }),
  );

  // External package import — should pass (hook only checks local paths).
  const ext = await runHook(
    "pre-edit-hallucination-guard.mjs",
    writePayload({
      filePath: "packages/shared/src/ok.ts",
      content: `import { z } from "zod"\n`,
    }),
  );
  results.push(
    expect(permissionDecisionFrom(ext.parsed), {
      eq: null,
      label: "external import allowed",
    }),
  );

  return combine(results);
}
