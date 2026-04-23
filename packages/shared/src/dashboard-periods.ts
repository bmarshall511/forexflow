/**
 * Dashboard period helpers — resolve (period, mode) → date range.
 *
 * The dashboard exposes five user-facing periods:
 *   `today` | `thisWeek` | `thisMonth` | `thisYear` | `allTime`
 * and two boundary modes:
 *   `local`  — browser-local calendar day at midnight, ISO week starts Monday.
 *   `forex`  — forex trading day (5 PM ET anchors) from `forex-trading-day.ts`.
 *
 * Every consumer (hooks, API routes, charts) takes a period + mode and
 * calls `resolveDashboardPeriod()` to get `{ dateFrom, dateTo | undefined }`.
 * That keeps boundary semantics in one place and avoids drift between the
 * daemon, the web app, and client-side toggles.
 *
 * @module dashboard-periods
 */
import {
  getForexDayStart,
  getForexWeekStart,
  getForexMonthStart,
  getForexYearStart,
} from "./forex-trading-day"

/** The five period options a user can pick on the dashboard. */
export type DashboardPeriod = "today" | "thisWeek" | "thisMonth" | "thisYear" | "allTime"

/** Boundary semantics for the period picker — user-selectable. */
export type DashboardPeriodMode = "local" | "forex"

export interface DashboardPeriodRange {
  /** Inclusive start of the window. Null/undefined is not produced — even `allTime` falls through to a very old epoch. */
  dateFrom: Date
  /**
   * Exclusive end of the window. Undefined for open-ended "current" periods
   * (today, thisWeek, thisMonth, thisYear, allTime) — analytics treat
   * absent `dateTo` as "through now".
   */
  dateTo?: Date
}

/**
 * Start of today under the chosen mode.
 * - `local`: browser-local calendar midnight.
 * - `forex`: most recent 5 PM ET boundary.
 */
export function startOfToday(now: Date, mode: DashboardPeriodMode): Date {
  if (mode === "forex") return getForexDayStart(now)
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Start of the current week under the chosen mode.
 * - `local`: ISO week — Monday at local midnight (matches "what a normal
 *   person calls 'this week' in most non-US calendars"; ISO is the sanest
 *   default across locales).
 * - `forex`: Sunday 5 PM ET — the global forex market open.
 */
export function startOfWeek(now: Date, mode: DashboardPeriodMode): Date {
  if (mode === "forex") return getForexWeekStart(now)
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  // Monday = 1, Sunday = 0. Offset so Monday is the first day.
  const dow = d.getDay()
  const daysSinceMonday = (dow + 6) % 7
  d.setDate(d.getDate() - daysSinceMonday)
  return d
}

/**
 * Start of the current month under the chosen mode.
 * - `local`: 1st of the current calendar month at local midnight.
 * - `forex`: 1st of the current month at 5 PM ET.
 */
export function startOfMonth(now: Date, mode: DashboardPeriodMode): Date {
  if (mode === "forex") return getForexMonthStart(now)
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
}

/**
 * Start of the current year under the chosen mode.
 * - `local`: Jan 1 of the current year at local midnight.
 * - `forex`: Jan 1 at 5 PM ET.
 */
export function startOfYear(now: Date, mode: DashboardPeriodMode): Date {
  if (mode === "forex") return getForexYearStart(now)
  return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
}

/** Effective epoch for "all time" — conservative floor older than any realistic forex data. */
const ALL_TIME_EPOCH = new Date(Date.UTC(2000, 0, 1, 0, 0, 0, 0))

/**
 * Resolve a (period, mode) pair to a concrete date range. `dateTo` is left
 * undefined for open-ended "current" windows — analytics treat that as
 * "through now" and day-boundary rollover is handled by the caller
 * re-invoking this function at the period boundary.
 */
export function resolveDashboardPeriod(
  period: DashboardPeriod,
  mode: DashboardPeriodMode,
  now: Date = new Date(),
): DashboardPeriodRange {
  switch (period) {
    case "today":
      return { dateFrom: startOfToday(now, mode) }
    case "thisWeek":
      return { dateFrom: startOfWeek(now, mode) }
    case "thisMonth":
      return { dateFrom: startOfMonth(now, mode) }
    case "thisYear":
      return { dateFrom: startOfYear(now, mode) }
    case "allTime":
      return { dateFrom: ALL_TIME_EPOCH }
  }
}

/**
 * Milliseconds until the next period boundary crosses for the given period
 * under the given mode. Returned as a positive number; callers can schedule
 * a `setTimeout` to invalidate caches when the period rolls over.
 *
 * Returns `null` for `allTime` since it never rolls over.
 */
export function msUntilNextBoundary(
  period: DashboardPeriod,
  mode: DashboardPeriodMode,
  now: Date = new Date(),
): number | null {
  if (period === "allTime") return null

  // Compute the next boundary by advancing `now` until a boundary bigger
  // than the current period start is produced. For week/month/year this is
  // still O(1) — we just compute the "start of next X" directly.
  const currentStart = resolveDashboardPeriod(period, mode, now).dateFrom
  let nextStart: Date
  switch (period) {
    case "today": {
      const one = new Date(currentStart)
      one.setDate(one.getDate() + 1)
      nextStart = mode === "forex" ? getForexDayStart(new Date(one.getTime() + 60_000)) : one
      break
    }
    case "thisWeek": {
      const one = new Date(currentStart)
      one.setDate(one.getDate() + 7)
      nextStart = mode === "forex" ? getForexWeekStart(new Date(one.getTime() + 60_000)) : one
      break
    }
    case "thisMonth": {
      const one = new Date(currentStart)
      one.setMonth(one.getMonth() + 1)
      nextStart = mode === "forex" ? getForexMonthStart(new Date(one.getTime() + 60_000)) : one
      break
    }
    case "thisYear": {
      const one = new Date(currentStart)
      one.setFullYear(one.getFullYear() + 1)
      nextStart = mode === "forex" ? getForexYearStart(new Date(one.getTime() + 60_000)) : one
      break
    }
  }
  return Math.max(0, nextStart.getTime() - now.getTime())
}
