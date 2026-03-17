/**
 * SmartFlow Activity Feed — ring buffer for real-time activity events.
 *
 * Similar to Trade Finder's auto-trade-events pattern. Stores the last 100
 * activity events in memory, exposed via REST endpoint and WS broadcast.
 *
 * @module activity-feed
 */

import type { SmartFlowActivityEvent, SmartFlowActivityType } from "@fxflow/types"

const MAX_EVENTS = 100
const events: SmartFlowActivityEvent[] = []
let idCounter = 0

export function emitActivity(
  type: SmartFlowActivityType,
  message: string,
  opts?: {
    instrument?: string
    detail?: string
    severity?: "info" | "success" | "warning" | "error"
    tradeId?: string
    configId?: string
  },
): SmartFlowActivityEvent {
  const event: SmartFlowActivityEvent = {
    id: `sf-${Date.now()}-${++idCounter}`,
    type,
    timestamp: new Date().toISOString(),
    instrument: opts?.instrument ?? null,
    message,
    detail: opts?.detail ?? null,
    severity: opts?.severity ?? "info",
    tradeId: opts?.tradeId ?? null,
    configId: opts?.configId ?? null,
  }
  events.push(event)
  if (events.length > MAX_EVENTS) events.shift()
  return event
}

export function getActivityEvents(): SmartFlowActivityEvent[] {
  return [...events]
}

export function clearActivityEvents(): void {
  events.length = 0
}
