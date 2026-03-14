---
name: add-api-route
description: Create a new Next.js API route with proper typing and error handling.
disable-model-invocation: true
---

# Add API Route

Create a new Next.js App Router API route.

## Arguments

- `$ARGUMENTS[0]` — Route path (e.g., "api/trades/export")
- `$ARGUMENTS[1]` — HTTP methods to support (e.g., "GET,POST")

## Pattern

```typescript
// apps/web/src/app/api/{path}/route.ts
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // For DB reads: import from @fxflow/db
    // For daemon proxy: fetch from DAEMON_URL
    const data = await someService()
    return Response.json(data)
  } catch (error) {
    console.error("[API] /api/{path} error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
```

## Rules

- DB reads: import directly from `@fxflow/db`
- Trade actions: proxy to daemon REST API (http://localhost:4100)
- Always handle errors with try/catch
- Return typed responses
- Log errors with route context prefix
