/**
 * News filter — dependency-injected news gate.
 *
 * `packages/shared` cannot import `@fxflow/db`, so this module expects
 * callers to provide a `NewsCalendarSource` implementation that knows how
 * to ask "is there a high-impact event imminent for this instrument?". The
 * daemon wires the DB-backed source (`hasImminentHighImpactEvent`) at call
 * time.
 *
 * Replaces SmartFlow's inline `checkNews` in `entry-filters.ts` and the
 * ad-hoc EdgeFinder calendar usage in `data-aggregator.ts`.
 *
 * @module trading-core/news-gate
 */

import type { GateResult } from "./types"
import { fail, pass } from "./types"

export interface ImminentEvent {
  imminent: boolean
  event?: string | null
}

/** Minimal interface the daemon must provide. */
export interface NewsCalendarSource {
  /**
   * @param instrument OANDA instrument like "EUR_USD".
   * @param bufferHours Look-ahead buffer in hours (can be fractional).
   */
  hasImminentEvent(instrument: string, bufferHours: number): Promise<ImminentEvent>
}

export interface CheckNewsGateOpts {
  instrument: string
  bufferMinutes: number
  source: NewsCalendarSource
}

export async function checkNewsGate(opts: CheckNewsGateOpts): Promise<GateResult> {
  const { instrument, bufferMinutes, source } = opts
  const bufferHours = Math.max(0.01, bufferMinutes / 60)
  try {
    const result = await source.hasImminentEvent(instrument, bufferHours)
    if (result.imminent) {
      return fail(`High-impact news imminent${result.event ? `: ${result.event}` : ""}`)
    }
    return pass()
  } catch (err) {
    // Fail-open: if the calendar source errors, let trading continue and
    // log via the error string. Propagating the throw would pause every
    // system that uses the gate whenever the DB has a hiccup.
    return {
      passed: true,
      reason: `news source error: ${(err as Error).message}`,
    }
  }
}
