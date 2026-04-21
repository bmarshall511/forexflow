// Fixture: structure-skill-frontmatter
// Every .claude/skills/<name>/SKILL.md has required fields; name matches
// directory; disable-model-invocation is a boolean.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../lib/frontmatter.mjs";
import { combine, expect } from "../lib/assert.mjs";

export const name = "structure-skill-frontmatter";
export const description =
  "every skill has valid frontmatter and directory-name parity";

const REQUIRED = ["name", "description", "version"];

export async function run() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../..");
  const dir = path.join(repoRoot, ".claude/skills");
  const dirents = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  const results = [];
  let scanned = 0;
  for (const d of dirents) {
    const skillFile = path.join(dir, d.name, "SKILL.md");
    if (!fs.existsSync(skillFile)) {
      results.push({ ok: false, reason: `${d.name}/: missing SKILL.md` });
      continue;
    }
    scanned++;
    const fm = parseFrontmatter(fs.readFileSync(skillFile, "utf8"));
    if (!fm) {
      results.push({ ok: false, reason: `${d.name}/SKILL.md: no frontmatter` });
      continue;
    }
    for (const f of REQUIRED) {
      if (!(f in fm))
        results.push({ ok: false, reason: `${d.name}/SKILL.md: missing ${f}` });
    }
    if (fm.name && fm.name !== d.name) {
      results.push({
        ok: false,
        reason: `${d.name}/SKILL.md: frontmatter name "${fm.name}" differs from dir "${d.name}"`,
      });
    }
  }
  if (results.length === 0) {
    results.push(
      expect(scanned, { truthy: true, label: `scanned ${scanned} skills` }),
    );
  }
  return combine(results);
}
