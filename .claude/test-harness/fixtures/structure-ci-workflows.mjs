// Fixture: structure-ci-workflows
// Asserts the CI workflow catalog is present and each workflow is
// syntactically a valid YAML-like document (basic well-formed check).
// Also validates commitlint.config.mjs and .releaserc.json parse.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { combine, expect } from "../lib/assert.mjs";

export const name = "structure-ci-workflows";
export const description =
  "every documented CI workflow exists; supporting config files parse cleanly";

// Mirrors docs/dev/CI.md §"Workflow catalog". Update both together.
const REQUIRED_WORKFLOWS = [
  "claude-config.yml",
  "agent-config-drift.yml",
  "codeql.yml",
  "gitleaks.yml",
  "ci-push.yml",
  "ci-pr.yml",
  "release.yml",
];

const REQUIRED_CONFIGS = [
  { path: "commitlint.config.mjs", kind: "js" },
  { path: "renovate.json", kind: "json" },
  { path: ".releaserc.json", kind: "json" },
  { path: "docs/dev/CI.md", kind: "md" },
];

export async function run() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../..");
  const workflowsDir = path.join(repoRoot, ".github/workflows");

  const results = [];

  // Every documented workflow exists
  for (const w of REQUIRED_WORKFLOWS) {
    const full = path.join(workflowsDir, w);
    results.push(
      expect(fs.existsSync(full), {
        truthy: true,
        label: `.github/workflows/${w} exists`,
      }),
    );

    if (fs.existsSync(full)) {
      const body = fs.readFileSync(full, "utf8");
      // Minimum viable YAML structure: a top-level `name:` and at least one job
      results.push(
        expect(/^name:\s+\S/m.test(body), {
          truthy: true,
          label: `${w}: has top-level name`,
        }),
      );
      results.push(
        expect(/^jobs:\s*$/m.test(body), {
          truthy: true,
          label: `${w}: has jobs block`,
        }),
      );
    }
  }

  // Supporting config files exist and parse
  for (const cfg of REQUIRED_CONFIGS) {
    const full = path.join(repoRoot, cfg.path);
    if (!fs.existsSync(full)) {
      results.push({ ok: false, reason: `${cfg.path}: missing` });
      continue;
    }
    const body = fs.readFileSync(full, "utf8");
    if (cfg.kind === "json") {
      try {
        JSON.parse(body);
      } catch (err) {
        results.push({
          ok: false,
          reason: `${cfg.path}: invalid JSON — ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } else if (cfg.kind === "js") {
      // Just check the file exports something (has `export default` or `module.exports`)
      results.push(
        expect(/export\s+default|module\.exports/.test(body), {
          truthy: true,
          label: `${cfg.path}: has an export`,
        }),
      );
    } else if (cfg.kind === "md") {
      // Md config is the CI docs page; confirm it lists all workflows
      const missing = REQUIRED_WORKFLOWS.filter((w) => !body.includes(w));
      if (missing.length) {
        results.push({
          ok: false,
          reason: `${cfg.path}: doesn't reference ${missing.join(", ")}`,
        });
      }
    }
  }

  if (results.every((r) => r.ok)) {
    results.push(
      expect(REQUIRED_WORKFLOWS.length, {
        truthy: true,
        label: `${REQUIRED_WORKFLOWS.length} workflows + ${REQUIRED_CONFIGS.length} config files validated`,
      }),
    );
  }

  return combine(results);
}
