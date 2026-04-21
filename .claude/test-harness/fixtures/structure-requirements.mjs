// Fixture: structure-requirements
// Asserts the requirements scaffolding is in place and internally
// consistent:
//   - docs/requirements/README.md, _template.md, index.md exist
//   - docs/requirements/.reqid-counters/ has one file per commit-scope
//   - each counter file holds a single non-negative integer
//   - template frontmatter has the required fields

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../lib/frontmatter.mjs";
import { combine, expect } from "../lib/assert.mjs";

export const name = "structure-requirements";
export const description =
  "docs/requirements/ scaffold (README, template, index, per-scope counters) is present and valid";

// Match the scopes documented in .reqid-counters/README.md and the
// commit-scope enum from .claude/context/conventions.md. Kept in sync
// by hand; drift would be a harness finding.
const REQUIRED_SCOPES = [
  "trading",
  "web",
  "daemon",
  "cf-worker",
  "mcp-server",
  "desktop",
  "db",
  "shared",
  "types",
  "config",
  "logger",
  "claude",
  "repo",
];

const TEMPLATE_REQUIRED_FIELDS = [
  "id",
  "title",
  "status",
  "scope",
  "owner",
  "created",
  "implemented",
  "tests",
  "code",
  "related",
];

export async function run() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../..");
  const reqDir = path.join(repoRoot, "docs/requirements");

  const results = [];

  // Required files exist
  for (const rel of ["README.md", "_template.md", "index.md"]) {
    const full = path.join(reqDir, rel);
    results.push(
      expect(fs.existsSync(full), {
        truthy: true,
        label: `docs/requirements/${rel} exists`,
      }),
    );
  }

  // Counter directory exists
  const countersDir = path.join(reqDir, ".reqid-counters");
  if (!fs.existsSync(countersDir)) {
    results.push({ ok: false, reason: ".reqid-counters/ directory missing" });
    return combine(results);
  }

  // Every required scope has a counter file with a valid integer value
  for (const scope of REQUIRED_SCOPES) {
    const f = path.join(countersDir, scope);
    if (!fs.existsSync(f)) {
      results.push({ ok: false, reason: `counter missing: ${scope}` });
      continue;
    }
    const raw = fs.readFileSync(f, "utf8").trim();
    if (!/^\d+$/.test(raw)) {
      results.push({
        ok: false,
        reason: `counter ${scope}: expected non-negative integer, got "${raw}"`,
      });
    }
  }

  // Template frontmatter validity
  const tplPath = path.join(reqDir, "_template.md");
  if (fs.existsSync(tplPath)) {
    const fm = parseFrontmatter(fs.readFileSync(tplPath, "utf8"));
    if (!fm) {
      results.push({ ok: false, reason: "_template.md: no frontmatter" });
    } else {
      for (const field of TEMPLATE_REQUIRED_FIELDS) {
        if (!(field in fm)) {
          results.push({
            ok: false,
            reason: `_template.md: missing required frontmatter field ${field}`,
          });
        }
      }
    }
  }

  if (results.every((r) => r.ok)) {
    results.push(
      expect(REQUIRED_SCOPES.length, {
        truthy: true,
        label: `validated ${REQUIRED_SCOPES.length} scope counters + scaffold files`,
      }),
    );
  }
  return combine(results);
}
