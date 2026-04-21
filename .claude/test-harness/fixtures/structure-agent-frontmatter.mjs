// Fixture: structure-agent-frontmatter
// Every .claude/agents/*.md (minus README) has required frontmatter
// fields with valid enum values.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../lib/frontmatter.mjs";
import { combine, expect } from "../lib/assert.mjs";

export const name = "structure-agent-frontmatter";
export const description = "every agent file has valid frontmatter";

const REQUIRED = [
  "name",
  "description",
  "model",
  "tools",
  "version",
  "timebox_minutes",
];
const MODELS = new Set(["opus", "sonnet", "haiku"]);

export async function run() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../..");
  const dir = path.join(repoRoot, ".claude/agents");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort();

  const results = [];
  for (const file of files) {
    const fm = parseFrontmatter(fs.readFileSync(path.join(dir, file), "utf8"));
    if (!fm) {
      results.push({ ok: false, reason: `${file}: no frontmatter` });
      continue;
    }
    for (const field of REQUIRED) {
      if (!(field in fm)) {
        results.push({ ok: false, reason: `${file}: missing ${field}` });
      }
    }
    if (fm.model && !MODELS.has(fm.model)) {
      results.push({
        ok: false,
        reason: `${file}: model must be opus|sonnet|haiku, got ${fm.model}`,
      });
    }
    if (fm.tools !== undefined && !Array.isArray(fm.tools)) {
      results.push({ ok: false, reason: `${file}: tools must be an array` });
    }
  }
  if (results.length === 0) {
    results.push(
      expect(files.length, {
        truthy: true,
        label: `scanned ${files.length} agents`,
      }),
    );
  }
  return combine(results);
}
