/**
 * SmartFlow Activity Feed — persisted activity log with in-memory cache.
 *
 * Events are written to DB (SmartFlowActivityLog) for persistence across restarts,
 * and cached in memory for fast REST reads. On startup, the cache is populated
 * from the DB.
 *
 * @module activity-feed
 */

import type {
  SmartFlowActivityEvent,
  SmartFlowActivityType,
  SmartFlowActivityContext,
} from "@fxflow/types"
import { createActivityLog, getActivityLogs, clearActivityLogs } from "@fxflow/db"

const MAX_CACHED = 100
let cache: SmartFlowActivityEvent[] = []
let initialized = false

type BroadcastFn = (type: string, data: unknown) => void
let broadcastFn: BroadcastFn | null = null

/** Set the broadcast function for WebSocket delivery. */
export function setActivityBroadcast(fn: BroadcastFn): void {
  broadcastFn = fn
}

/** Load recent activity from DB into memory cache. Call once on daemon startup. */
export async function initActivityFeed(): Promise<void> {
  try {
    cache = await getActivityLogs(MAX_CACHED)
    initialized = true
    console.log(`[smart-flow-activity] Loaded ${cache.length} events from DB`)
  } catch (err) {
    console.warn("[smart-flow-activity] Failed to load from DB:", (err as Error).message)
    initialized = true
  }
}

/**
 * Emit and persist a new activity event.
 * Writes to DB (async, non-blocking) and appends to in-memory cache.
 */
export function emitActivity(
  type: SmartFlowActivityType,
  message: string,
  opts?: {
    instrument?: string
    detail?: string
    severity?: "info" | "success" | "warning" | "error"
    tradeId?: string
    configId?: string
    context?: SmartFlowActivityContext
  },
): SmartFlowActivityEvent {
  const event: SmartFlowActivityEvent = {
    id: `sf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    timestamp: new Date().toISOString(),
    instrument: opts?.instrument ?? null,
    message,
    detail: opts?.detail ?? null,
    severity: opts?.severity ?? "info",
    tradeId: opts?.tradeId ?? null,
    configId: opts?.configId ?? null,
    context: opts?.context ?? null,
  }

  // Broadcast via WebSocket for real-time UI updates
  broadcastFn?.("smart_flow_activity", event)

  // Append to in-memory cache
  cache.push(event)
  if (cache.length > MAX_CACHED) cache.shift()

  // Persist to DB (fire-and-forget)
  createActivityLog({
    type: event.type,
    message: event.message,
    detail: event.detail,
    severity: event.severity,
    instrument: event.instrument,
    tradeId: event.tradeId,
    configId: event.configId,
  }).catch((err) => {
    console.warn("[smart-flow-activity] DB write failed:", (err as Error).message)
  })

  return event
}

/** Get cached activity events (fast, no DB call). */
export function getActivityEvents(): SmartFlowActivityEvent[] {
  return [...cache]
}

/** Clear all activity events (both in-memory and DB). */
export async function clearActivityEvents(): Promise<void> {
  cache.length = 0
  try {
    await clearActivityLogs()
  } catch (err) {
    console.warn("[smart-flow-activity] DB clear failed:", (err as Error).message)
  }
}

/** Whether the feed has been initialized from DB. */
export function isInitialized(): boolean {
  return initialized
}
