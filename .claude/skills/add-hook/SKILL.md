---
name: add-hook
description: Scaffold an apps/web React hook (use-*.ts) with sibling Vitest spec; tagged to a requirement
disable-model-invocation: false
model: sonnet
args:
  - name: name
    type: string
    required: true
    description: "Hook name without the 'use-' prefix, e.g. 'daemon-connection', 'live-price'"
dispatches: [test-writer]
version: 0.1.0
---

# /add-hook `<name>`

Scaffold `apps/web/src/hooks/use-<name>.ts` with a sibling unit test. Enforces rule 07 (≤200 LOC) and rule 01/02 from line one.

## Procedure

### 1. Resolve the file path

```
apps/web/src/hooks/use-<name>.ts        # hook
apps/web/src/hooks/use-<name>.test.ts   # sibling unit test
```

### 2. Ask for the essentials

- What state or effect does this hook own? (single responsibility)
- Which requirement does it implement? (REQ-WEB-<area>-<num>)
- Does it consume a context (DaemonStatus, InternetStatus, etc.) or produce one?

### 3. Write the hook

Template:

```ts
import { useCallback, useEffect, useState } from "react"

/**
 * <one-line description>.
 *
 * @req: REQ-WEB-<AREA>-<###>
 */
export interface Use<Name>Options {
  readonly <option>?: <type>
}

export interface Use<Name>Result {
  readonly <value>: <type>
  readonly <action>: () => void
}

export function use<Name>(options: Use<Name>Options = {}): Use<Name>Result {
  const [state, setState] = useState<...>()

  useEffect(() => {
    // ...
    return () => { /* cleanup */ }
  }, [/* deps */])

  const action = useCallback(() => { /* ... */ }, [])

  return { state, action }
}
```

Enforced from line one:

- JSDoc on every export (rule 13)
- `@req:` tag (rule 14)
- `readonly` props (rule 01)
- Named exports only (rule 08)
- Effect cleanup functions — never set up a subscription without tearing it down
- No raw `process.env.*` (rule 11 — use env helpers)
- Target under 200 LOC (rule 07)

### 4. Write the unit test

Dispatch `test-writer` with the subject. Expected test cases:

- Happy path: hook returns expected initial state
- Dependency changes: hook reacts to context changes
- Cleanup: unmounting tears down subscriptions

Hooks that integrate with DOM APIs (visibility, online/offline, matchMedia) use `@testing-library/react`'s `renderHook` + event dispatch.

### 5. Run /verify and /review

## Output shape

```markdown
# /add-hook result — use-<name>

## Files created

- `apps/web/src/hooks/use-<name>.ts` — <N> LOC (limit 200)
- `apps/web/src/hooks/use-<name>.test.ts` — <N> LOC

## Requirement: REQ-WEB-<AREA>-<###>

## Test-writer verdict: WRITTEN / PARTIAL

## Review: APPROVE / SAFE

## Next step

- Consume from a container component
- Document in `apps/web/CLAUDE.md` §Hooks if it's a widely-consumed hook
```

## Bootstrap tolerance

Returns "N/A — `apps/web/` arrives in Phase 7" during earlier phases.

## Time / cost

Sonnet-tier, under a minute typical.
