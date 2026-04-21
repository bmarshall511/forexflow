// Fixture: hook-post-todowrite-plan-marker
// Invokes the hook with a TodoWrite payload and confirms a marker file
// is written under .claude/.session-state/plans/.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHook, permissionDecisionFrom } from "../lib/hook-runner.mjs";
import { todoWritePayload } from "../lib/fixture.mjs";
import { expect, combine } from "../lib/assert.mjs";

export const name = "hook-post-todowrite-plan-marker";
export const description =
  "post-todowrite-plan-marker writes a marker file under .claude/.session-state/plans/";

export async function run() {
  const results = [];
  const scratch = fs.mkdtempSync(
    path.join(process.env.TMPDIR || os.tmpdir(), "forexflow-plan-mark-"),
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

    const r = await runHook(
      "post-todowrite-plan-marker.mjs",
      todoWritePayload([
        {
          content: "write fixture",
          activeForm: "Writing fixture",
          status: "in_progress",
        },
      ]),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(r.parsed), { eq: null, label: "no deny" }),
    );

    const dir = path.join(scratch, ".claude/.session-state/plans");
    const exists = fs.existsSync(dir);
    results.push(expect(exists, { truthy: true, label: "plans dir created" }));

    const files = exists ? fs.readdirSync(dir) : [];
    results.push(expect(files.length, { eq: 1, label: "marker file count" }));
    if (files.length === 1) {
      const body = fs.readFileSync(path.join(dir, files[0]), "utf8");
      results.push(
        expect(body, {
          includes: "todoCount",
          label: "marker body contains todoCount",
        }),
      );
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  return combine(results);
}
