// Fixture: hook-post-edit-meta-log
// Writes a scratch CHANGELOG.md in the repoRoot-equivalent, invokes the
// hook on a .claude/rules/* edit, asserts a line gets appended.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHook, permissionDecisionFrom } from "../lib/hook-runner.mjs";
import { writePayload } from "../lib/fixture.mjs";
import { expect, combine } from "../lib/assert.mjs";

export const name = "hook-post-edit-meta-log";
export const description =
  "post-edit-meta-log appends entries; dedupes; skips CHANGELOG itself";

export async function run() {
  const results = [];
  const scratch = fs.mkdtempSync(
    path.join(process.env.TMPDIR || os.tmpdir(), "forexflow-metalog-"),
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
    fs.mkdirSync(path.join(scratch, ".claude/rules"), { recursive: true });
    fs.writeFileSync(
      path.join(scratch, ".claude/rules/01-typescript.md"),
      "# ts\n",
    );
    fs.writeFileSync(
      path.join(scratch, ".claude/CHANGELOG.md"),
      "# Changelog\n\n## [Unreleased]\n\n### Added\n\n- (pending — next sub-phase)\n",
    );

    // First invocation — should append a line.
    const r1 = await runHook(
      "post-edit-meta-log.mjs",
      writePayload({
        filePath: ".claude/rules/01-typescript.md",
        content: "# ts edited\n",
      }),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(r1.parsed), {
        eq: null,
        label: "no deny on first run",
      }),
    );
    const after1 = fs.readFileSync(
      path.join(scratch, ".claude/CHANGELOG.md"),
      "utf8",
    );
    results.push(
      expect(after1, {
        includes: "rule: `.claude/rules/01-typescript.md`",
        label: "entry appended",
      }),
    );

    // Second invocation on same path — dedup, same count of matching lines.
    const before2 = after1
      .split("\n")
      .filter((l) => l.includes("01-typescript.md")).length;
    await runHook(
      "post-edit-meta-log.mjs",
      writePayload({
        filePath: ".claude/rules/01-typescript.md",
        content: "# ts edited again\n",
      }),
      { cwd: scratch },
    );
    const after2 = fs.readFileSync(
      path.join(scratch, ".claude/CHANGELOG.md"),
      "utf8",
    );
    const after2Count = after2
      .split("\n")
      .filter((l) => l.includes("01-typescript.md")).length;
    results.push(
      expect(after2Count, {
        eq: before2,
        label: "no duplicate entry on second run",
      }),
    );

    // Edit to CHANGELOG.md itself — must NOT recurse/append.
    const r3 = await runHook(
      "post-edit-meta-log.mjs",
      writePayload({ filePath: ".claude/CHANGELOG.md", content: after2 }),
      { cwd: scratch },
    );
    results.push(
      expect(permissionDecisionFrom(r3.parsed), {
        eq: null,
        label: "no deny on CHANGELOG edit",
      }),
    );
    const after3 = fs.readFileSync(
      path.join(scratch, ".claude/CHANGELOG.md"),
      "utf8",
    );
    results.push(
      expect(after3, {
        eq: after2,
        label: "CHANGELOG edit not self-appended (recursion guard)",
      }),
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  return combine(results);
}
