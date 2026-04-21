// Fixture: hook-user-prompt-context-warn
// The hook reads transcript-file sizes from the user's Claude Code state
// directory, which harness runs can't guarantee. We only verify that the
// hook exits 0 on a standard UserPromptSubmit payload (never blocks) and
// emits either nothing or a well-formed additionalContext envelope.

import {
  runHook,
  permissionDecisionFrom,
  reasonFrom,
} from "../lib/hook-runner.mjs";
import { expect, combine } from "../lib/assert.mjs";

export const name = "hook-user-prompt-context-warn";
export const description = "user-prompt-context-warn exits 0 and never denies";

export async function run() {
  const results = [];
  const r = await runHook("user-prompt-context-warn.mjs", {
    prompt: "any sample prompt",
    session_id: "harness-smoke",
  });
  results.push(expect(r.code, { eq: 0, label: "exit code" }));
  results.push(
    expect(permissionDecisionFrom(r.parsed), {
      eq: null,
      label: "never denies",
    }),
  );
  // If output is non-empty, it must mention /handoff guidance.
  if (
    r.parsed &&
    r.parsed.hookSpecificOutput &&
    r.parsed.hookSpecificOutput.additionalContext
  ) {
    results.push(
      expect(r.parsed.hookSpecificOutput.additionalContext, {
        includes: "handoff",
        label: "context warning mentions handoff",
      }),
    );
  } else {
    // No output is also valid — means no warning threshold tripped.
    results.push(
      expect(reasonFrom(r.parsed), {
        eq: null,
        label: "no reason when silent",
      }),
    );
  }
  return combine(results);
}
