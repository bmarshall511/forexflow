/**
 * Calendar service — upsert, query, and clean up economic calendar events.
 *
 * Events are fetched periodically by the daemon's CalendarFetcher and stored
 * in the EconomicEvent table. The web app queries upcoming events via
 * `getUpcomingEvents()` for the dashboard calendar card.
 *
 * @module calendar-service
 */
import { db } from "./client"
import type { EconomicEventData, EconomicEventImpact } from "@fxflow/types"

// ─── Input type ─────────────────────────────────────────────────────────────

export interface EconomicEventInput {
  title: string
  currency: string
  impact: EconomicEventImpact
  actual?: string | null
  forecast?: string | null
  previous?: string | null
  timestamp: Date
}

// ─── Upsert ─────────────────────────────────────────────────────────────────

/**
 * Bulk upsert economic events by title+timestamp unique combo.
 * Returns the number of events upserted.
 */
export async function upsertEconomicEvents(events: EconomicEventInput[]): Promise<number> {
  if (events.length === 0) return 0

  let count = 0
  for (const event of events) {
    await db.economicEvent.upsert({
      where: {
        title_timestamp: {
          title: event.title,
          timestamp: event.timestamp,
        },
      },
      create: {
        title: event.title,
        currency: event.currency,
        impact: event.impact,
        actual: event.actual ?? null,
        forecast: event.forecast ?? null,
        previous: event.previous ?? null,
        timestamp: event.timestamp,
      },
      update: {
        actual: event.actual ?? null,
        forecast: event.forecast ?? null,
        previous: event.previous ?? null,
        fetchedAt: new Date(),
      },
    })
    count++
  }

  return count
}

// ─── Queries ────────────────────────────────────────────────────────────────

function toEventData(row: {
  id: string
  title: string
  currency: string
  impact: string
  actual: string | null
  forecast: string | null
  previous: string | null
  timestamp: Date
}): EconomicEventData {
  return {
    id: row.id,
    title: row.title,
    currency: row.currency,
    impact: row.impact as EconomicEventImpact,
    actual: row.actual,
    forecast: row.forecast,
    previous: row.previous,
    timestamp: row.timestamp.toISOString(),
  }
}

/**
 * Get upcoming economic events within a time window.
 * Defaults to the next 48 hours, ordered by timestamp ascending.
 */
export async function getUpcomingEvents(options?: {
  hours?: number
  impact?: string
  currency?: string
}): Promise<EconomicEventData[]> {
  const hours = options?.hours ?? 48
  const now = new Date()
  const cutoff = new Date(now.getTime() + hours * 60 * 60 * 1000)

  const where: Record<string, unknown> = {
    timestamp: { gte: now, lte: cutoff },
  }
  if (options?.impact) where.impact = options.impact
  if (options?.currency) where.currency = options.currency

  const rows = await db.economicEvent.findMany({
    where,
    orderBy: { timestamp: "asc" },
  })

  return rows.map(toEventData)
}

/**
 * Get events in a specific date range, ordered by timestamp ascending.
 */
export async function getEventsInRange(from: Date, to: Date): Promise<EconomicEventData[]> {
  const rows = await db.economicEvent.findMany({
    where: { timestamp: { gte: from, lte: to } },
    orderBy: { timestamp: "asc" },
  })

  return rows.map(toEventData)
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

/**
 * Delete events older than N days (default 30). Returns the count deleted.
 */
export async function cleanupOldEvents(daysOld = 30): Promise<number> {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)
  const result = await db.economicEvent.deleteMany({
    where: { timestamp: { lt: cutoff } },
  })
  return result.count
}
