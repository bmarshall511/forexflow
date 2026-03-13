---
paths:
  - "apps/web/**"
---

# Next.js + UI Conventions

- App Router only. No Pages Router.
- Components must be small and composable (≤150 LOC).
- Mobile-first responsive layout. Touch-friendly targets. No hover-only interactions.
- shadcn/ui: prefer variants over custom one-offs. Extend only for consistent styling/behavior/a11y.
- Realtime: websocket → dispatcher → state store → UI. No per-page ad hoc WebSocket logic.
- Memoize derived computations. Keep re-render surfaces small (container/presenter splits).
- API routes proxy to daemon REST API for trade actions, use DB directly for reads.
