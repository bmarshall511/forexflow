// Fixture: structure-rule-frontmatter
// Every .claude/rules/NN-<name>.md has valid frontmatter: required
// fields present, enforcement enum valid, scope is an array.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, combine } from "../lib/assert.mjs";

export const name = "structure-rule-frontmatter";
export const description =
  "every rule file has valid frontmatter per .claude/rules/README.md schema";

const REQUIRED = ["name", "scope", "enforcement", "version", "applies_when"];
const ENFORCEMENT_VALUES = new Set(["strict", "advisory"]);

export async function run() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../..");
  const dir = path.join(repoRoot, ".claude/rules");

  const results = [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort();

  for (const file of files) {
    const full = path.join(dir, file);
    const content = fs.readFileSync(full, "utf8");
    const fm = parseFrontmatter(content);

    if (!fm) {
      results.push({ ok: false, reason: `${file}: no frontmatter` });
      continue;
    }

    for (const field of REQUIRED) {
      if (!(field in fm)) {
        results.push({
          ok: false,
          reason: `${file}: missing required field ${field}`,
        });
      }
    }

    if (fm.enforcement && !ENFORCEMENT_VALUES.has(fm.enforcement)) {
      results.push({
        ok: false,
        reason: `${file}: enforcement must be strict|advisory, got ${fm.enforcement}`,
      });
    }

    if (fm.scope !== undefined && !Array.isArray(fm.scope)) {
      results.push({ ok: false, reason: `${file}: scope must be an array` });
    }
  }

  if (results.length === 0) {
    results.push(
      expect(files.length, {
        truthy: true,
        label: `scanned ${files.length} rule files`,
      }),
    );
  }
  return combine(results);
}

function parseFrontmatter(src) {
  if (!src.startsWith("---\n")) return null;
  const end = src.indexOf("\n---", 4);
  if (end === -1) return null;
  const raw = src.slice(4, end);
  const out = {};
  let key = null;
  let list = null;
  for (const line of raw.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const arr = line.match(/^\s+-\s+(.*)$/);
    if (arr && list) {
      list.push(stripQ(arr[1]));
      continue;
    }
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (v === "" || v === "|") {
      list = [];
      out[k] = list;
      key = k;
      continue;
    }
    if (v.startsWith("[") && v.endsWith("]")) {
      out[k] = v
        .slice(1, -1)
        .split(",")
        .map((s) => stripQ(s.trim()))
        .filter(Boolean);
      list = null;
      key = null;
      continue;
    }
    out[k] = stripQ(v);
    list = null;
    key = null;
  }
  return out;
}

function stripQ(s) {
  if (!s) return "";
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}
