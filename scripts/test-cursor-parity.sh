#!/usr/bin/env bash
# scripts/test-cursor-parity.sh
#
# Validates that .cursor/rules/ is in sync with .claude/rules/ and that a
# representative rule contains the enforcement semantics both IDEs need.
# Used by CI (agent-config-drift workflow) and dispatchable via the
# /stale-rules skill.
#
# Exits 0 on parity; exits 1 on drift with a human-readable report.

set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." &> /dev/null && pwd)"
cd "$REPO_ROOT"

echo "==> Running generator in --check mode"
if ! node scripts/sync-ide-rules.mjs --check; then
  echo "PARITY FAIL — regenerate and re-stage"
  exit 1
fi

echo "==> Verifying every .claude/rules/<name>.md has a .cursor/rules/<name>.mdc"
missing=0
for rule in .claude/rules/*.md; do
  [ "$(basename "$rule")" = "README.md" ] && continue
  name="$(basename "$rule" .md)"
  mdc=".cursor/rules/${name}.mdc"
  if [ ! -f "$mdc" ]; then
    echo "  MISSING: $mdc (source: $rule)"
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then
  echo "PARITY FAIL — run: node scripts/sync-ide-rules.mjs"
  exit 1
fi

echo "==> Verifying every .claude/skills/<name>/SKILL.md has a .cursor/commands/<name>.md"
missing=0
for skill in .claude/skills/*/SKILL.md; do
  name="$(basename "$(dirname "$skill")")"
  cmd=".cursor/commands/${name}.md"
  if [ ! -f "$cmd" ]; then
    echo "  MISSING: $cmd (source: $skill)"
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then
  echo "PARITY FAIL — run: node scripts/sync-ide-rules.mjs"
  exit 1
fi

echo "==> Spot-check: rule 01-typescript mentions 'no \`any\`' in both sources"
claude_has=$(grep -c "No \`any\`\|no \`any\`" .claude/rules/01-typescript.md || true)
cursor_has=$(grep -c "No \`any\`\|no \`any\`" .cursor/rules/01-typescript.mdc || true)
if [ "$claude_has" -lt 1 ] || [ "$cursor_has" -lt 1 ]; then
  echo "  SEMANTIC DRIFT: rule 01-typescript missing 'no any' language"
  echo "    .claude hits: $claude_has"
  echo "    .cursor hits: $cursor_has"
  exit 1
fi

echo
echo "PARITY PASS — .claude/rules ↔ .cursor/rules and .claude/skills ↔ .cursor/commands are in sync"
