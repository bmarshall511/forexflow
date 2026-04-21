// Fixture: structure-cursor-parity
// Runs scripts/sync-ide-rules.mjs --check in the repo root; asserts exit 0.
// If this fails, the operator must regenerate .cursor/ before committing.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { combine, expect } from "../lib/assert.mjs";

export const name = "structure-cursor-parity";
export const description =
  ".claude/rules <-> .cursor/rules parity via sync-ide-rules --check";

export async function run() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../..");
  const script = path.join(repoRoot, "scripts/sync-ide-rules.mjs");
  const r = spawnSync("node", [script, "--check"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  const results = [];
  results.push(expect(r.status, { eq: 0, label: "--check exit code" }));
  if (r.status !== 0) {
    return combine([
      ...results,
      { ok: false, reason: `stdout:\n${r.stdout}\nstderr:\n${r.stderr}` },
    ]);
  }
  results.push(
    expect(r.stdout, { includes: "in sync", label: "reports in-sync" }),
  );
  return combine(results);
}
