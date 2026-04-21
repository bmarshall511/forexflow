// Fixture: structure-rule-hook-coverage
// Every rule with enforcement: strict cites at least one backing
// enforcer — a hook (hooks/*.mjs) or a reviewer agent
// (agents/<name>-reviewer.md or agents/code-reviewer.md etc.) — in
// its related[] frontmatter, AND every cited artifact exists on disk.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../lib/frontmatter.mjs";
import { combine, expect } from "../lib/assert.mjs";

export const name = "structure-rule-hook-coverage";
export const description =
  "every strict rule has a backing enforcer (hook or reviewer agent)";

export async function run() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../..");
  const rulesDir = path.join(repoRoot, ".claude/rules");

  const files = fs
    .readdirSync(rulesDir)
    .filter((f) => f.endsWith(".md") && f !== "README.md");
  const problems = [];
  let strictCount = 0;

  for (const file of files) {
    const fm = parseFrontmatter(
      fs.readFileSync(path.join(rulesDir, file), "utf8"),
    );
    if (!fm || fm.enforcement !== "strict") continue;
    strictCount++;

    const related = Array.isArray(fm.related) ? fm.related : [];
    const enforcers = related.filter(
      (r) =>
        typeof r === "string" &&
        (r.startsWith("hooks/") || r.startsWith("agents/")),
    );

    if (enforcers.length === 0) {
      problems.push({
        ok: false,
        reason: `${file}: strict rule with no hook or reviewer agent in related[]`,
      });
      continue;
    }

    for (const ref of enforcers) {
      const abs = path.join(repoRoot, ".claude", ref);
      if (!fs.existsSync(abs)) {
        problems.push({
          ok: false,
          reason: `${file}: related enforcer missing on disk: ${ref}`,
        });
      }
    }
  }

  if (problems.length === 0) {
    problems.push(
      expect(strictCount, {
        truthy: true,
        label: `${strictCount} strict rules have backing enforcers`,
      }),
    );
  }
  return combine(problems);
}
