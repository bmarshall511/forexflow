/**
 * commitlint configuration for ForexFlow.
 *
 * Rule source: .claude/rules/10-git-workflow.md + context/conventions.md.
 * Scope enum mirrors docs/requirements/.reqid-counters/ plus a few
 * commit-only scopes that never mint requirements (ci, style).
 *
 * Phase 1 state: most scopes exist as placeholders because the
 * corresponding apps/packages haven't shipped yet. commitlint does
 * not care that the scope's code is absent — the enum is about allowed
 * labels on commits, not about whether the subject of the commit
 * currently has code.
 */

export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "perf",
        "refactor",
        "docs",
        "test",
        "chore",
        "ci",
        "build",
        "style",
        "revert",
      ],
    ],
    "scope-enum": [
      2,
      "always",
      [
        // App-level scopes — code arrives in Phases 5+
        "web",
        "daemon",
        "cf-worker",
        "mcp-server",
        "desktop",

        // Package-level scopes — code arrives in Phases 3+
        "db",
        "shared",
        "types",
        "config",
        "logger",

        // Infrastructure and meta scopes — active from Phase 1
        "claude",
        "repo",
        "docs",
        "ci",
        "agents",
        "hooks",
        "skills",
        "rules",
        "deps",
      ],
    ],
    "scope-empty": [2, "never"],
    "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};
