/**
 * Time-exit decision helper.
 *
 * SmartFlow and EdgeFinder both close stale trades after a profile/preset-
 * specific maximum hold time. This centralises the "how long has it been
 * open?" calculation so callers just feed in `openedAt` and `maxHours`.
 *
 * @module trading-core/management/time-exit
 */

export interface TimeExitDecision {
  shouldFire: boolean
  hoursOpen: number
  reason: string
}

export interface TimeExitEvalOpts {
  /** Epoch ms when the trade opened. */
  openedAt: number
  /** Maximum hold time in hours. */
  maxHours: number
  /** Optional clock override for tests. Defaults to Date.now(). */
  now?: number
}

export function evaluateTimeExit(opts: TimeExitEvalOpts): TimeExitDecision {
  const now = opts.now ?? Date.now()
  const hoursOpen = (now - opts.openedAt) / 3_600_000
  if (opts.maxHours <= 0) {
    return { shouldFire: false, hoursOpen, reason: "time exit disabled" }
  }
  if (hoursOpen < opts.maxHours) {
    return {
      shouldFire: false,
      hoursOpen,
      reason: `${hoursOpen.toFixed(1)}h < limit ${opts.maxHours.toFixed(1)}h`,
    }
  }
  return {
    shouldFire: true,
    hoursOpen,
    reason: `${hoursOpen.toFixed(1)}h >= limit ${opts.maxHours.toFixed(1)}h`,
  }
}
