// Fixture: structure-stale-refs
// For every markdown file under .claude/, collect in-body path
// references that look like repo paths and verify they resolve on disk.
// A few well-known template placeholders are exempted.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { combine, expect } from "../lib/assert.mjs";

export const name = "structure-stale-refs";
export const description =
  "every repo-path reference inside .claude/**/*.md resolves";

// Paths that legitimately don't exist until later phases, or that are
// gitignored runtime artifacts referenced in documentation. The harness
// can be tightened as each phase lands.
const EXEMPT_PREFIXES = [
  "apps/",
  "packages/",
  "docs/requirements/",
  "docs/dev/api/",
  "docs/dev/architecture.md",
  "docs/dev/ARCHITECTURE.md",
  "docs/dev/ci.md",
  "docs/dev/CI.md",
  "docs/dev/DEPLOYMENT.md",
  "docs/dev/TESTING.md",
  "docs/dev/realtime.md",
  "docs/user/",
  "scripts/preflight.sh",
  "scripts/dev.sh",
  "scripts/fix-standalone-native.sh",
  "scripts/backfills/",
  "site/",
  // Phase-2 toolchain files — arrive via /bootstrap
  "turbo.json",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "lefthook.yml",
  "commitlint.config.mjs",
  "vitest.config.ts",
  "playwright.config.ts",
  "knip.json",
  // Gitignored per-user / runtime files
  ".claude/config/reserved-identifiers.json",
  ".claude/config/cost-caps.json",
  ".claude/failure-modes.md",
  ".claude/handoffs/latest.md",
  ".claude/handoffs/",
  ".claude/journal/",
  // Template placeholders common in docs
  ".claude/plans/phase-",
  ".claude/rules/NN-",
  ".cursor/rules/NN-",
];

// Match paths that clearly reference a file (has an extension) or an
// explicit deeper path (contains a slash). Bare directory names like
// "apps" or "packages" are ignored — they're conceptual references.
const PATH_RE =
  /(?:^|[\s(`'"])((?:\.claude|\.cursor|\.github|docs|scripts|site|apps|packages)\/[A-Za-z0-9_\-./*\[\]]+)/g;

export async function run() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../..");
  const mdFiles = walkMarkdown(path.join(repoRoot, ".claude"));

  const problems = [];
  let checked = 0;

  for (const file of mdFiles) {
    const rel = path.relative(repoRoot, file);
    const text = fs.readFileSync(file, "utf8");
    const stripped = stripCodeBlocks(text);
    PATH_RE.lastIndex = 0;
    let m;
    while ((m = PATH_RE.exec(stripped)) !== null) {
      const candidate = m[1];
      // Strip trailing punctuation but preserve file extensions.
      const clean = candidate.replace(/[)"'`,:]+$/, "");
      if (isExempt(clean)) continue;
      if (clean.includes("*") || clean.includes("[") || clean.includes("]"))
        continue;
      if (clean.endsWith("/")) continue;
      // Only count as a path if the final segment looks file-like
      // (contains a dot). Bare prose fragments like "scripts/dirs" get
      // caught by PATH_RE but aren't meaningful to resolve.
      const lastSeg = clean.split("/").pop() || "";
      if (!lastSeg.includes(".")) continue;
      checked++;
      const abs = path.join(repoRoot, clean);
      if (!fs.existsSync(abs)) {
        problems.push({
          ok: false,
          reason: `${rel}: unresolved path "${clean}"`,
        });
      }
    }
  }

  if (problems.length === 0) {
    problems.push(
      expect(checked, {
        truthy: true,
        label: `verified ${checked} paths in ${mdFiles.length} files`,
      }),
    );
  }
  return combine(problems);
}

function walkMarkdown(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === ".session-state" ||
      entry.name === "telemetry" ||
      entry.name === "handoffs"
    )
      continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdown(full));
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

function stripCodeBlocks(src) {
  // Drop triple-backtick fenced blocks, which routinely contain illustrative
  // paths that don't need to resolve.
  return src.replace(/```[\s\S]*?```/g, "");
}

function isExempt(p) {
  return EXEMPT_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix));
}
