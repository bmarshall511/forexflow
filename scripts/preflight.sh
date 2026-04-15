#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# FXFlow Preflight — Local CI mirror
#
# Runs every check from GitHub Actions CI + Security workflows locally
# so failures are caught before pushing.
#
# Usage:
#   pnpm preflight              # full run (mirrors CI exactly)
#   pnpm preflight:quick        # skip build, audit, security
#   pnpm preflight --no-build   # skip individual steps
#   pnpm preflight --continue   # run all steps, report failures at end
#
# Flags:
#   --quick         skip build, audit, and security checks
#   --no-build      skip Next.js web build
#   --no-audit      skip pnpm audit
#   --no-security   skip gitleaks secret scanning
#   --no-coverage   skip test coverage (still runs tests)
#   --continue      don't fail-fast; run all steps and summarize at end
#   --help          show this help
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colors & symbols ─────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

PASS="${GREEN}PASS${RESET}"
FAIL="${RED}FAIL${RESET}"
SKIP="${DIM}SKIP${RESET}"
WARN="${YELLOW}WARN${RESET}"

# ── Parse flags ──────────────────────────────────────────────────────────────

SKIP_BUILD=false
SKIP_AUDIT=false
SKIP_SECURITY=false
SKIP_COVERAGE=false
FAIL_FAST=true

for arg in "$@"; do
  case "$arg" in
    --quick)
      SKIP_BUILD=true
      SKIP_AUDIT=true
      SKIP_SECURITY=true
      ;;
    --no-build)    SKIP_BUILD=true ;;
    --no-audit)    SKIP_AUDIT=true ;;
    --no-security) SKIP_SECURITY=true ;;
    --no-coverage) SKIP_COVERAGE=true ;;
    --continue)    FAIL_FAST=false ;;
    --help|-h)
      echo ""
      echo "FXFlow Preflight — Local CI mirror"
      echo ""
      echo "Usage:"
      echo "  pnpm preflight              full run (mirrors CI exactly)"
      echo "  pnpm preflight:quick        skip build, audit, security"
      echo ""
      echo "Flags:"
      echo "  --quick         skip build, audit, and security checks"
      echo "  --no-build      skip Next.js web build"
      echo "  --no-audit      skip pnpm audit"
      echo "  --no-security   skip gitleaks secret scanning"
      echo "  --no-coverage   skip test coverage (still runs tests)"
      echo "  --continue      don't fail-fast; run all steps and summarize at end"
      echo "  --help          show this help"
      echo ""
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown flag: ${arg}${RESET}"
      echo "Run with --help for usage."
      exit 1
      ;;
  esac
done

# ── State ────────────────────────────────────────────────────────────────────

STEP=0
TOTAL=11
FAILURES=()
STEP_NAMES=()
STEP_RESULTS=()
START_TIME=$SECONDS

# ── Helpers ──────────────────────────────────────────────────────────────────

step_header() {
  STEP=$((STEP + 1))
  STEP_NAMES[$STEP]="$1"
  printf "  ${DIM}[%2d/%d]${RESET} %-30s " "$STEP" "$TOTAL" "$1"
}

step_pass() {
  echo -e "$PASS"
  STEP_RESULTS[$STEP]="pass"
}

step_warn() {
  echo -e "$WARN ${DIM}($1)${RESET}"
  STEP_RESULTS[$STEP]="warn"
}

step_fail() {
  echo -e "$FAIL"
  STEP_RESULTS[$STEP]="fail"
  FAILURES+=("$STEP: ${STEP_NAMES[$STEP]}")
  if $FAIL_FAST; then
    echo ""
    echo -e "  ${RED}${BOLD}✗ Preflight failed at step $STEP: ${STEP_NAMES[$STEP]}${RESET}"
    if [ -n "${1:-}" ]; then
      echo -e "    ${DIM}$1${RESET}"
    fi
    echo ""
    exit 1
  fi
}

step_skip() {
  echo -e "$SKIP"
  STEP_RESULTS[$STEP]="skip"
}

run_step() {
  local output
  local exit_code=0
  output=$(eval "$1" 2>&1) || exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo ""
    echo -e "${DIM}${output}${RESET}" | tail -20
    echo ""
    return 1
  fi
  return 0
}

# ── Banner ───────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}━━━ FXFlow Preflight ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

if $SKIP_BUILD || $SKIP_AUDIT || $SKIP_SECURITY; then
  skipped=()
  $SKIP_BUILD && skipped+=("build")
  $SKIP_AUDIT && skipped+=("audit")
  $SKIP_SECURITY && skipped+=("security")
  echo -e "  ${DIM}Skipping: ${skipped[*]}${RESET}"
  echo ""
fi

# ── Step 1: Frozen lockfile ──────────────────────────────────────────────────

step_header "Frozen lockfile"
if run_step "pnpm install --frozen-lockfile --dry-run"; then
  step_pass
else
  step_fail "Run 'pnpm install' to update the lockfile."
fi

# ── Step 2: Prisma generate ─────────────────────────────────────────────────

step_header "Prisma generate"
if run_step "DATABASE_URL=file:\${TMPDIR:-/tmp}/fxflow-prisma-hook.db pnpm --filter @fxflow/db db:generate"; then
  step_pass
else
  step_fail "Prisma client generation failed."
fi

# ── Step 3: Format check ────────────────────────────────────────────────────

step_header "Format check"
if run_step "pnpm format:check"; then
  step_pass
else
  step_fail "Run 'pnpm format' to fix formatting."
fi

# ── Step 4: Lint ─────────────────────────────────────────────────────────────

step_header "Lint"
if run_step "pnpm lint"; then
  step_pass
else
  step_fail "Fix lint errors above."
fi

# ── Step 5: Typecheck ────────────────────────────────────────────────────────

step_header "Typecheck"
if run_step "pnpm typecheck"; then
  step_pass
else
  step_fail "Fix type errors above."
fi

# ── Step 6: Tests ────────────────────────────────────────────────────────────

step_header "Tests"
if $SKIP_COVERAGE; then
  test_cmd="pnpm test"
else
  test_cmd="pnpm test -- --coverage"
fi
if run_step "$test_cmd"; then
  step_pass
else
  step_fail "Fix failing tests above."
fi

# ── Step 7: Build ────────────────────────────────────────────────────────────

step_header "Build (web)"
if $SKIP_BUILD; then
  step_skip
else
  if run_step "pnpm --filter @fxflow/web build"; then
    step_pass
  else
    step_fail "Next.js build failed."
  fi
fi

# ── Step 8: Prisma drift ────────────────────────────────────────────────────

step_header "Prisma drift"
if run_step "cd packages/db && DATABASE_URL=file:\${TMPDIR:-/tmp}/fxflow-prisma-hook.db pnpm prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code"; then
  step_pass
else
  step_fail "Schema is out of sync with migrations. Run 'pnpm prisma migrate dev'."
fi

# ── Step 9: Audit ────────────────────────────────────────────────────────────

step_header "Audit"
if $SKIP_AUDIT; then
  step_skip
else
  # CI uses continue-on-error, so we warn instead of fail
  if run_step "pnpm audit --audit-level=high"; then
    step_pass
  else
    step_warn "vulnerabilities found"
  fi
fi

# ── Step 10: Import boundaries ──────────────────────────────────────────────

step_header "Import boundaries"
boundary_violations=$(grep -rn "from ['\"].*apps/" packages/*/src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [ -z "$boundary_violations" ]; then
  step_pass
else
  echo ""
  echo -e "${DIM}${boundary_violations}${RESET}"
  echo ""
  step_fail "packages/ must not import from apps/."
fi

# ── Step 11: Secret scanning ────────────────────────────────────────────────

step_header "Secret scanning"
if $SKIP_SECURITY; then
  step_skip
elif ! command -v gitleaks &>/dev/null; then
  step_warn "gitleaks not installed"
else
  if run_step "gitleaks detect --no-banner"; then
    step_pass
  else
    step_fail "Secrets detected. Review gitleaks output above."
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────

ELAPSED=$((SECONDS - START_TIME))
echo ""

if [ ${#FAILURES[@]} -gt 0 ]; then
  echo -e "  ${RED}${BOLD}✗ Preflight failed${RESET} ${DIM}(${ELAPSED}s)${RESET}"
  echo ""
  for f in "${FAILURES[@]}"; do
    echo -e "    ${RED}✗${RESET} Step $f"
  done
  echo ""
  exit 1
else
  echo -e "  ${GREEN}${BOLD}✓ Preflight passed${RESET} ${DIM}(${ELAPSED}s)${RESET}"
  echo ""
  exit 0
fi
