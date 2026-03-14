---
name: add-daemon-endpoint
description: Add a new daemon REST endpoint with types, handler, web API proxy, and hook.
disable-model-invocation: true
---

# Add Daemon Endpoint

Wire a new REST endpoint through daemon → web API → hook.

## Arguments

- `$ARGUMENTS[0]` — HTTP method and path (e.g., "POST /actions/my-action")
- `$ARGUMENTS[1]` — Description of what it does

## Steps

1. **packages/types/src/index.ts** — Add request/response types:

   ```typescript
   export interface MyActionRequest { ... }
   export interface MyActionResponse { ... }
   ```

2. **apps/daemons/src/server.ts** — Add route handler:

   ```typescript
   if (method === "POST" && pathname === "/actions/my-action") {
     const body = await parseBody<MyActionRequest>(req)
     // ... execute action
     return json(result)
   }
   ```

3. **apps/web/src/app/api/my-action/route.ts** — Create Next.js API route that proxies to daemon:

   ```typescript
   const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL || "http://localhost:4100"
   export async function POST(request: Request) {
     const body = await request.json()
     const res = await fetch(`${DAEMON_URL}/actions/my-action`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(body),
     })
     const data = await res.json()
     return Response.json(data)
   }
   ```

4. **apps/web/src/hooks/use-\*.ts** — Add hook method or create new hook:

   ```typescript
   const myAction = async (params: MyActionRequest) => {
     const res = await fetch("/api/my-action", { method: "POST", body: JSON.stringify(params) })
     // handle response, toast, etc.
   }
   ```

5. Run `/verify`.
