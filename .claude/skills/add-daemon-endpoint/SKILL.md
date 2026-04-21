---
name: add-daemon-endpoint
description: Wire a new Hono endpoint through daemon → web API proxy → React hook end-to-end with tests at every layer
disable-model-invocation: false
model: sonnet
args:
  - name: route
    type: string
    required: true
    description: "Method + path, e.g. 'POST /actions/close-trade'"
  - name: description
    type: string
    required: true
    description: "One-line description of what the endpoint does"
dispatches: [test-writer]
version: 0.1.0
---

# /add-daemon-endpoint `<route>` `<description>`

End-to-end wiring for a new daemon endpoint. Adds the Hono route, the web API proxy, a consuming React hook, and integration tests for each layer. Enforces the "one WebSocket / one message-type contract / one consumer context" architecture from rule 15.

## Procedure

### 1. Resolve paths

```
packages/types/src/<domain>.ts                         # request + response Zod schemas
apps/daemon/src/<subsystem>/<route-slug>.ts            # Hono handler
apps/daemon/src/__tests__/integration/<slug>.test.ts   # daemon integration test
apps/web/src/app/api/<path>/route.ts                   # Next.js proxy handler
apps/web/src/app/api/<path>/route.test.ts              # web integration test
apps/web/src/hooks/use-<hook-name>.ts                  # React hook
apps/web/src/hooks/use-<hook-name>.test.ts             # hook unit test
```

### 2. Ask

- Which daemon subsystem owns this endpoint? (`oanda`, `ai`, `trade-finder`, etc.)
- Which requirement? REQ-<SCOPE>-<###>
- Is it read (daemon returns state) or action (daemon mutates + returns result)?
- Needs auth? (typically yes — web proxy requires auth; daemon trusts web)
- Needs to emit a WebSocket event on completion? (if yes, dispatch `/add-ws-event` separately)

### 3. Add type contracts

In `packages/types/src/<domain>.ts`:

```ts
import { z } from "zod";

/**
 * Request for <route>.
 *
 * @req: REQ-<SCOPE>-<###>
 */
export const CloseTradeRequestSchema = z.object({
  tradeId: z.string(),
  reason: z.enum(["manual", "emergency"]).default("manual"),
});
export type CloseTradeRequest = z.infer<typeof CloseTradeRequestSchema>;

export const CloseTradeResponseSchema = z.object({
  tradeId: z.string(),
  closedAt: z.string().datetime(),
  realizedPL: z.number(),
});
export type CloseTradeResponse = z.infer<typeof CloseTradeResponseSchema>;
```

### 4. Daemon handler (Hono)

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  CloseTradeRequestSchema,
  CloseTradeResponseSchema,
} from "@forexflow/types";
import { daemonLogger } from "@forexflow/logger/daemon";
import { closeTrade } from "./close-trade";

const log = daemonLogger.child({ subsystem: "oanda", action: "close-trade" });

export const closeTradeRoute = new Hono().post(
  "/",
  zValidator("json", CloseTradeRequestSchema),
  async (c) => {
    const input = c.req.valid("json");
    const reqLog = log.child({ tradeId: input.tradeId });
    try {
      const result = await closeTrade(input);
      return c.json(CloseTradeResponseSchema.parse(result));
    } catch (err) {
      reqLog.error({ err }, "close trade failed");
      return c.json(
        { error: { code: "CLOSE_FAILED", message: "Failed to close trade" } },
        500,
      );
    }
  },
);
```

Register on the main daemon app.

### 5. Web proxy

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { CloseTradeRequestSchema } from "@forexflow/types";
import { webLogger } from "@forexflow/logger/web";
import { daemonUrl } from "@/lib/daemon-url";

export async function POST(request: NextRequest) {
  const correlationId =
    request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  const log = webLogger.child({ correlationId, route: "/api/trades/close" });
  try {
    await requireAuth(request);
    const body = CloseTradeRequestSchema.parse(await request.json());
    const response = await fetch(`${daemonUrl()}/actions/close-trade`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": correlationId,
      },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await response.json(), {
      status: response.status,
    });
  } catch (err) {
    log.error({ err }, "proxy failed");
    return NextResponse.json(
      { error: { code: "PROXY_FAILED", message: "Upstream error" } },
      { status: 502 },
    );
  }
}
```

### 6. React hook

```ts
import { useState } from "react";
import type { CloseTradeRequest, CloseTradeResponse } from "@forexflow/types";

/**
 * React hook to close a trade via the daemon.
 *
 * @req: REQ-<SCOPE>-<###>
 */
export function useCloseTrade() {
  const [inFlight, setInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function closeTrade(
    input: CloseTradeRequest,
  ): Promise<CloseTradeResponse> {
    setInFlight(true);
    setError(null);
    try {
      const res = await fetch("/api/trades/close", {
        method: "POST",
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setInFlight(false);
    }
  }

  return { closeTrade, inFlight, error };
}
```

### 7. Tests at every layer

Dispatch `test-writer` with each layer:

- Daemon integration: happy path, auth context, error path, Zod validation
- Web proxy: auth denial, upstream error envelope, header propagation
- React hook: state transitions (`inFlight`, `error`), error surfacing

### 8. Wire into a consuming component (if applicable)

Do not land a hook with zero consumers. Either wire into a component in the same commit, or hold the skill until the consumer is ready.

### 9. Review

`/review` + `/security-review` — always. Both layers have auth and injection surfaces.

## Output shape

```markdown
# /add-daemon-endpoint result — <route>

## Files created

- `packages/types/src/<domain>.ts` — added schemas
- `apps/daemon/src/<subsystem>/<slug>.ts` — handler
- `apps/daemon/src/__tests__/integration/<slug>.test.ts` — integration test
- `apps/web/src/app/api/<path>/route.ts` — proxy
- `apps/web/src/app/api/<path>/route.test.ts` — integration test
- `apps/web/src/hooks/use-<hook-name>.ts` — hook
- `apps/web/src/hooks/use-<hook-name>.test.ts` — unit test

## Requirement: REQ-<SCOPE>-<###>

## Test-writer: WRITTEN / PARTIAL

## Review: APPROVE / SAFE

## Security-review: PASS / ADVISORY / FAIL
```

## Bootstrap tolerance

Returns "N/A — `apps/daemon/` arrives in Phase 5, `apps/web/` in Phase 7" during earlier phases. Sub-skills activate partially as each app lands.
