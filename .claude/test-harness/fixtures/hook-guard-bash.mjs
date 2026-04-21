/**
 * Fixture: hook-guard-bash
 * Asserts guard-bash denies a destructive command and allows a safe one.
 */

import {
  runHook,
  permissionDecisionFrom,
  reasonFrom,
} from "../lib/hook-runner.mjs";
import { bashPayload } from "../lib/fixture.mjs";
import { expect, combine } from "../lib/assert.mjs";

export const name = "hook-guard-bash";
export const description = "guard-bash denies rm -rf /; allows benign commands";

export async function run() {
  const results = [];

  // Destructive command → expect deny
  const deny = await runHook("guard-bash.mjs", bashPayload("rm -rf /"));
  results.push(expect(deny.code, { eq: 0, label: "destructive exit code" }));
  results.push(
    expect(permissionDecisionFrom(deny.parsed), {
      eq: "deny",
      label: "destructive decision",
    }),
  );
  results.push(
    expect(reasonFrom(deny.parsed), {
      includes: "guard-bash",
      label: "destructive reason",
    }),
  );

  // Force-push to main → expect deny
  const forcePush = await runHook(
    "guard-bash.mjs",
    bashPayload("git push --force origin main"),
  );
  results.push(
    expect(permissionDecisionFrom(forcePush.parsed), {
      eq: "deny",
      label: "force-push decision",
    }),
  );

  // Safe command → expect no deny response
  const safe = await runHook("guard-bash.mjs", bashPayload("ls -la"));
  results.push(expect(safe.code, { eq: 0, label: "safe exit code" }));
  results.push(
    expect(permissionDecisionFrom(safe.parsed), {
      eq: null,
      label: "safe decision (should be absent)",
    }),
  );

  return combine(results);
}
