/**
 * CleanupScheduler runs daily DB cleanup tasks during market close hours.
 *
 * Checks every hour whether it should run. Target window: 5:00 AM ET,
 * Sunday through Friday (skips Saturday — market fully closed, no urgency).
 * Only runs once per calendar day (ET).
 *
 * @module cleanup-scheduler
 */
import { toET } from "@fxflow/shared"
import {
  cleanupOldNotifications,
  cleanupOldAnalyses,
  cleanupOldZones,
  cleanupOldSignals,
  cleanupOldAuditEvents,
  cleanupExpiredData,
  cleanupOldOpportunities,
  cleanupOldTrends,
  cleanupOldCurveSnapshots,
  cleanupOldPerformance,
  cleanupOldEvents,
} from "@fxflow/db"

const ONE_HOUR_MS = 60 * 60 * 1000

export class CleanupScheduler {
  private interval: ReturnType<typeof setInterval> | null = null
  private lastRunDate: string | null = null // YYYY-MM-DD in ET

  start(): void {
    if (this.interval) return
    console.log("[cleanup-scheduler] Started (checks hourly, runs at 5 AM ET)")
    this.interval = setInterval(() => {
      if (this.shouldRun()) {
        void this.runCleanup()
      }
    }, ONE_HOUR_MS)

    // Also check immediately on startup (daemon may have been down during window)
    if (this.shouldRun()) {
      void this.runCleanup()
    }
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private shouldRun(): boolean {
    const now = new Date()
    const et = toET(now)

    // Skip Saturday (day 6) — market fully closed, no urgency
    if (et.day === 6) return false

    // Only run during the 5 AM ET hour (5:00-5:59)
    if (et.hour !== 5) return false

    // Check if we already ran today (ET date)
    const etDate = this.getETDateString(now)
    if (this.lastRunDate === etDate) return false

    return true
  }

  async runCleanup(): Promise<void> {
    const now = new Date()
    const etDate = this.getETDateString(now)
    this.lastRunDate = etDate

    console.log(`[cleanup-scheduler] Starting daily cleanup for ${etDate}`)
    const start = Date.now()

    const results: Array<{ task: string; deleted: number }> = []

    // 1. Notifications — 30 days
    try {
      const count = await cleanupOldNotifications(30)
      results.push({ task: "notifications", deleted: count })
    } catch (err) {
      console.error("[cleanup-scheduler] notifications failed:", (err as Error).message)
    }

    // 2. AI Analyses — 90 days
    try {
      const count = await cleanupOldAnalyses(90)
      results.push({ task: "ai-analyses", deleted: count })
    } catch (err) {
      console.error("[cleanup-scheduler] ai-analyses failed:", (err as Error).message)
    }

    // 3. Invalidated zones — 30 days
    try {
      const count = await cleanupOldZones(30)
      results.push({ task: "zones", deleted: count })
    } catch (err) {
      console.error("[cleanup-scheduler] zones failed:", (err as Error).message)
    }

    // 4. TV alert signals — 30 days
    try {
      const count = await cleanupOldSignals(30)
      results.push({ task: "tv-signals", deleted: count })
    } catch (err) {
      console.error("[cleanup-scheduler] tv-signals failed:", (err as Error).message)
    }

    // 5. Signal audit events — 30 days
    try {
      const count = await cleanupOldAuditEvents(30)
      results.push({ task: "audit-events", deleted: count })
    } catch (err) {
      console.error("[cleanup-scheduler] audit-events failed:", (err as Error).message)
    }

    // 6. Expired market data cache
    try {
      const count = await cleanupExpiredData()
      results.push({ task: "market-data-cache", deleted: count })
    } catch (err) {
      console.error("[cleanup-scheduler] market-data-cache failed:", (err as Error).message)
    }

    // 7. AI Trader opportunities — 60 days
    try {
      const count = await cleanupOldOpportunities(60)
      results.push({ task: "ai-opportunities", deleted: count })
    } catch (err) {
      console.error("[cleanup-scheduler] ai-opportunities failed:", (err as Error).message)
    }

    // 8. Old trends — 30 days
    try {
      const count = await cleanupOldTrends(30)
      results.push({ task: "trends", deleted: count })
    } catch (err) {
      console.error("[cleanup-scheduler] trends failed:", (err as Error).message)
    }

    // 9. Curve snapshots — 30 days
    try {
      const count = await cleanupOldCurveSnapshots(30)
      results.push({ task: "curve-snapshots", deleted: count })
    } catch (err) {
      console.error("[cleanup-scheduler] curve-snapshots failed:", (err as Error).message)
    }

    // 10. AI Trader performance — 180 days
    try {
      const count = await cleanupOldPerformance(180)
      results.push({ task: "ai-performance", deleted: count })
    } catch (err) {
      console.error("[cleanup-scheduler] ai-performance failed:", (err as Error).message)
    }

    // 11. Economic calendar events — 30 days
    try {
      const count = await cleanupOldEvents(30)
      results.push({ task: "calendar-events", deleted: count })
    } catch (err) {
      console.error("[cleanup-scheduler] calendar-events failed:", (err as Error).message)
    }

    const durationMs = Date.now() - start
    const summary = results.map((r) => `${r.task}=${r.deleted}`).join(", ")
    console.log(`[cleanup-scheduler] Completed in ${durationMs}ms: ${summary}`)
  }

  /** Format a Date as YYYY-MM-DD in ET timezone. */
  private getETDateString(date: Date): string {
    return date.toLocaleDateString("en-CA", { timeZone: "America/New_York" })
  }
}
