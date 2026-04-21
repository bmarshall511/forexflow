// Fixture: hook-stop-session-check
// Invokes the hook with an empty Stop payload in a scratch git repo;
// asserts exit 0, a systemMessage that names the branch, and that the
// .claude/.session-state/plans/ directory is cleaned if present.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHook } from "../lib/hook-runner.mjs";
import { expect, combine } from "../lib/assert.mjs";

export const name = "hook-stop-session-check";
export const description =
  "stop-session-check summarizes state and cleans session-state/plans/";

export async function run() {
  const results = [];
  const scratch = fs.mkdtempSync(
    path.join(process.env.TMPDIR || os.tmpdir(), "forexflow-stop-"),
  );
  try {
    sh(
      scratch,
      "git init -q && git config user.email t@t.io && git config user.name t",
    );
    fs.writeFileSync(path.join(scratch, "seed"), "x");
    sh(scratch, "git add seed && git commit -q -m seed");

    const here = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(here, "../../..");
    fs.cpSync(
      path.join(repoRoot, ".claude/hooks"),
      path.join(scratch, ".claude/hooks"),
      {
        recursive: true,
      },
    );

    // Seed a plan marker — expect it to be cleaned after the hook runs.
    const plansDir = path.join(scratch, ".claude/.session-state/plans");
    fs.mkdirSync(plansDir, { recursive: true });
    fs.writeFileSync(path.join(plansDir, "old-marker.json"), "{}");

    const r = await runHook("stop-session-check.mjs", {}, { cwd: scratch });
    results.push(expect(r.code, { eq: 0, label: "exit code 0" }));
    results.push(
      expect(r.parsed?.systemMessage, {
        includes: "Branch",
        label: "systemMessage names branch",
      }),
    );

    const after = fs.existsSync(plansDir) ? fs.readdirSync(plansDir) : [];
    results.push(
      expect(after.length, { eq: 0, label: "plan markers cleaned" }),
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  return combine(results);
}

function sh(cwd, cmd) {
  const r = spawnSync("sh", ["-c", cmd], { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`sh failed (${cmd}): ${r.stderr}`);
}
