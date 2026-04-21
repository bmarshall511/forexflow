---
name: smoke-test
description: Start dev, navigate to a feature, verify end-to-end behavior in a real browser — golden-path validation before declaring a UI change done
disable-model-invocation: false
model: sonnet
args:
  - name: feature
    type: string
    required: true
    description: "Feature or URL path to smoke-test, e.g. 'positions', '/ai-trader', 'tv-alerts test signal'"
dispatches: []
version: 0.1.0
---

# /smoke-test `<feature>`

Real-browser end-to-end verification. Confirms a feature works as a user would experience it, not just "tests pass locally." Activated in Phase 7+ when the web app exists.

## Why this exists

Type-check and unit tests verify code correctness. Smoke-tests verify **feature correctness**. A change can pass every test and still be broken from a user's perspective (wrong icon, misaligned layout on mobile, race on first load, wrong copy). This skill catches that.

Rule 00 §10 requires smoke-testing UI changes before calling them done.

## When to run

- Before any commit touching user-visible behavior in `apps/web/**` or `apps/desktop/**`
- Before closing out a sub-phase that added a feature
- After a major dependency bump
- When `/review` passes but the change feels complete-but-not-validated

## Procedure

### 1. Ensure dev environment is running

```bash
# Start dev if not already running
pnpm dev &
# Wait for ready signal
curl -s http://localhost:3000/api/health | jq -e '.ok'
curl -s http://localhost:4100/health | jq -e '.ok'
```

If dev fails to start, stop and investigate — a smoke-test against a broken dev server is misleading.

### 2. Resolve the feature target

Map the `feature` arg to a URL path:

- Free-text (`"positions"`) → `/positions`
- Path (`/ai-trader`) → that path
- Scenario (`"tv-alerts test signal"`) → describe the multi-step flow

If ambiguous, prompt for clarification.

### 3. Walk the golden path

For the target feature, exercise:

- **Load the page** — check HTTP 200, no console errors, no hydration warnings
- **Primary interaction** — the most important action a user performs on this page
- **Data correctness** — values on screen match expected (e.g., position P&L matches the seeded trade)
- **Edge cases** — empty state, loading state, error state if reachable

### 4. Check accessibility baseline

- Tab through the primary interactive elements; focus is visible
- Press Escape in any modal that was opened
- Inspect with axe if available; zero violations expected

### 5. Check mobile

```bash
# Via Playwright CLI (when app exists)
pnpm playwright test --project=mobile apps/web/e2e/<feature>.spec.ts
```

Or manually resize the browser to 375×812 and verify the layout:

- Cards not tables
- Touch targets ≥ 44×44
- No horizontal scroll
- Text legible at `text-base` minimum

### 6. Check dark/light (if theme-relevant)

Toggle the theme and confirm the feature remains legible and on-brand in both.

### 7. Reduced motion

Set `prefers-reduced-motion: reduce` (dev tools → rendering emulation) and confirm animations downgrade to instant transitions.

### 8. Network edge

If the feature uses realtime or polling:

- Disconnect the daemon (stop its process) — UI shows disconnected state without crashing
- Reconnect — UI recovers without a reload
- Network throttling (Slow 3G) — graceful loading / skeletons / retries

### 9. Document the run

Record what was exercised in the output so reviewers can reproduce:

## Output shape

```markdown
# /smoke-test result — <feature>

## Verdict: ✓ PASS / ⚠ ISSUES / ✗ BROKEN

**Target:** <URL or scenario>
**Duration:** <wall-clock>

## Golden path

- Load: <status>
- Primary action: <status>
- Data correctness: <status>
- Edge cases exercised: <list>

## Accessibility

- Keyboard nav: ✓ / ✗
- Focus visible: ✓ / ✗
- axe violations: 0 / N
- Screen reader spot-check: ✓ / ✗ / N/A

## Mobile (375×812)

- Layout: ✓ / ✗
- Touch targets: ✓ / ✗
- Horizontal scroll: ✗ none / ✓ found on <area>

## Theme

- Light: ✓ / ✗
- Dark: ✓ / ✗
- High contrast: ✓ / ✗ / N/A

## Reduced motion

- Respected: ✓ / ✗ / N/A

## Realtime / network edge

- Disconnect handling: ✓ / ✗ / N/A
- Reconnect: ✓ / ✗ / N/A
- Slow network: ✓ / ✗ / N/A

## Issues found

- <issue> — <file>:<line> — severity
- ...

## Reproduction recipe

Exact steps another person can run to reproduce this smoke-test.
```

## Bootstrap tolerance

During Phase 1–6 no web app exists. The skill returns "N/A — web app arrives in Phase 7" and exits. Do not invent a smoke test on nothing.

## What /smoke-test does NOT do

- Replace automated Playwright specs (those still ship per rule 02)
- Accept "my machine works" as sufficient — every run reports what was actually exercised
- Skip mobile or a11y checks as "obvious" — rule 03 treats those as baseline
- Fix issues — it reports; the implementer fixes

## Time / cost

Sonnet-tier, 5–15 minutes wall-clock depending on feature complexity. The one skill where wall-clock matters more than tokens.
