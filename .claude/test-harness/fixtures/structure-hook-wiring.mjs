// Fixture: structure-hook-wiring
// Every hook path referenced from .claude/settings.json exists on disk,
// and every .claude/hooks/*.mjs (minus lib/) is wired into settings.json.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { combine, expect } from "../lib/assert.mjs";

export const name = "structure-hook-wiring";
export const description = "settings.json hooks <-> .claude/hooks/*.mjs parity";

export async function run() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../..");
  const settings = JSON.parse(
    fs.readFileSync(path.join(repoRoot, ".claude/settings.json"), "utf8"),
  );
  const hooksDir = path.join(repoRoot, ".claude/hooks");

  const wired = collectWired(settings?.hooks || {});
  const onDisk = fs
    .readdirSync(hooksDir)
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => `.claude/hooks/${f}`);

  const results = [];

  // Every wired path resolves on disk.
  for (const p of wired) {
    const abs = path.join(repoRoot, p);
    if (!fs.existsSync(abs)) {
      results.push({ ok: false, reason: `wired hook not on disk: ${p}` });
    }
  }

  // Every top-level hook script is wired somewhere.
  for (const p of onDisk) {
    if (!wired.includes(p)) {
      results.push({ ok: false, reason: `hook on disk but not wired: ${p}` });
    }
  }

  if (results.length === 0) {
    results.push(
      expect(wired.length, {
        truthy: true,
        label: `${wired.length} wired, ${onDisk.length} on disk`,
      }),
    );
  }
  return combine(results);
}

function collectWired(hookTree) {
  const out = [];
  for (const event of Object.values(hookTree)) {
    if (!Array.isArray(event)) continue;
    for (const block of event) {
      for (const hook of block.hooks || []) {
        const cmd = hook.command || "";
        const m = cmd.match(/\.claude\/hooks\/[A-Za-z0-9_\-.]+/g);
        if (m) out.push(...m);
      }
    }
  }
  return Array.from(new Set(out));
}
