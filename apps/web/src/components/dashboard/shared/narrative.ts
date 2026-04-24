/**
 * Comparative-narrative helpers for the dashboard.
 *
 * Small, pure functions. No React, no fetches — just the text/numbers math
 * the UI needs for "+8% vs last week" copy and streak callouts. Anything
 * that needs a DB round trip belongs elsewhere; these helpers work off
 * values the page already has.
 */

export interface PeriodCompare {
  /** Current period value (e.g. totalPL for the selected range). */
  current: number
  /** Prior period value — same period shifted one window backwards. */
  prior: number
}

export interface NarrativeDelta {
  /** Absolute difference — sign preserved. */
  absolute: number
  /**
   * Percent change expressed as a decimal (0.08 = +8%). `null` when the
   * prior value was 0 — division would produce +Infinity which the UI
   * renders awkwardly; callers should show "new" or similar instead.
   */
  pct: number | null
}

/** Compute the absolute + percent delta between current and prior. */
export function comparePeriods({ current, prior }: PeriodCompare): NarrativeDelta {
  const absolute = current - prior
  if (prior === 0) return { absolute, pct: null }
  return { absolute, pct: absolute / Math.abs(prior) }
}

/**
 * Return the label text for a "vs previous" pill given the current user
 * period. Keeps the wording in one place so it's consistent across cards.
 */
export function vsPriorLabel(
  period: "today" | "thisWeek" | "thisMonth" | "thisYear" | "allTime",
): string {
  switch (period) {
    case "today":
      return "vs yesterday"
    case "thisWeek":
      return "vs last week"
    case "thisMonth":
      return "vs last month"
    case "thisYear":
      return "vs last year"
    case "allTime":
      return "overall"
  }
}
