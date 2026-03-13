---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Rules

- TypeScript must be strict. No `any` — use TODO comment if temporary.
- Prefer discriminated unions, branded types for IDs, exhaustive switch/never.
- Validate inputs at runtime boundaries (webhooks, API responses, user input) with Zod or equivalent.
- No silent catches. Errors must be typed, logged, surfaced to UI (user-safe).
