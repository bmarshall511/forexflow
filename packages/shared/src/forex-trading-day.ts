/**
 * Forex Trading Day boundary calculator.
 *
 * A forex "day" starts at 5:00 PM ET and ends at 4:59 PM ET the next calendar day.
 * The forex "week" starts Sunday 5:00 PM ET (when the market opens).
 * The forex "month" starts on the 1st of the month at 5:00 PM ET.
 * The forex "year" starts Jan 1 at 5:00 PM ET.
 *
 * All functions accept a UTC Date and use the same Intl-based ET conversion
 * from market-hours.ts to handle DST transitions correctly.
 */

import { getETOffsetHours, toET, isWeekendClosed, getETCalendarDate } from "./market-hours"

export interface ForexPeriodBoundaries {
  /** Start of current forex trading day (most recent 5 PM ET) */
  todayStart: Date
  /** Start of previous forex trading day */
  yesterdayStart: Date
  /** End of previous forex trading day (= todayStart) */
  yesterdayEnd: Date
  /** Start of current forex trading week (Sunday 5 PM ET) */
  weekStart: Date
  /** Start of current forex trading month (1st of month, 5 PM ET) */
  monthStart: Date
  /** Start of current forex trading year (Jan 1, 5 PM ET) */
  yearStart: Date
}

/**
 * Get the most recent forex day start (5:00 PM ET boundary).
 *
 * If the current ET time is before 5 PM, the forex day started at yesterday's 5 PM.
 * If the current ET time is at or after 5 PM, the forex day started at today's 5 PM.
 */
export function getForexDayStart(date: Date): Date {
  const et = toET(date)
  const offset = getETOffsetHours(date)

  // If before 5 PM ET, go back to yesterday's 5 PM ET
  if (et.hour < 17) {
    const yesterday = new Date(date)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const yesterdayOffset = getETOffsetHours(yesterday)
    return makeETDate(yesterday, 17, 0, yesterdayOffset)
  }

  // At or after 5 PM ET, use today's 5 PM ET
  return makeETDate(date, 17, 0, offset)
}

/**
 * Get the forex week start (Sunday 5:00 PM ET at or before the given date).
 */
export function getForexWeekStart(date: Date): Date {
  const et = toET(date)

  // Walk backward to find Sunday
  const result = new Date(date)
  let daysBack = et.day // Sunday = 0, so go back `day` days to reach Sunday

  // If it's Sunday before 5 PM, go back to previous Sunday
  if (et.day === 0 && et.hour < 17) {
    daysBack = 7
  }

  result.setUTCDate(result.getUTCDate() - daysBack)
  const sundayOffset = getETOffsetHours(result)
  return makeETDate(result, 17, 0, sundayOffset)
}

/**
 * Get the forex month start (1st of the current month at 5:00 PM ET).
 * If we're before Jan 1 5 PM ET, returns Dec 1 5 PM ET of previous year.
 */
export function getForexMonthStart(date: Date): Date {
  // Get the current date in ET to determine the calendar month
  const etFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  })
  const parts = etFmt.formatToParts(date)
  const year = parseInt(parts.find((p) => p.type === "year")?.value ?? "2026", 10)
  const month = parseInt(parts.find((p) => p.type === "month")?.value ?? "1", 10)
  const day = parseInt(parts.find((p) => p.type === "day")?.value ?? "1", 10)
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10)

  // If it's the 1st and before 5 PM, the forex month hasn't started yet — use previous month
  let targetYear = year
  let targetMonth = month
  if (day === 1 && hour < 17) {
    targetMonth -= 1
    if (targetMonth === 0) {
      targetMonth = 12
      targetYear -= 1
    }
  }

  // Build a Date for the 1st of the target month at 5 PM ET
  const firstOfMonth = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 12)) // noon UTC as seed
  const offset = getETOffsetHours(firstOfMonth)
  return makeETDate(firstOfMonth, 17, 0, offset)
}

/**
 * Get the forex year start (Jan 1 at 5:00 PM ET).
 * If we're before Jan 1 5 PM ET, returns previous year's Jan 1 5 PM ET.
 */
export function getForexYearStart(date: Date): Date {
  const etFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  })
  const parts = etFmt.formatToParts(date)
  const year = parseInt(parts.find((p) => p.type === "year")?.value ?? "2026", 10)
  const month = parseInt(parts.find((p) => p.type === "month")?.value ?? "1", 10)
  const day = parseInt(parts.find((p) => p.type === "day")?.value ?? "1", 10)
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10)

  let targetYear = year
  if (month === 1 && day === 1 && hour < 17) {
    targetYear -= 1
  }

  const jan1 = new Date(Date.UTC(targetYear, 0, 1, 12)) // noon UTC as seed
  const offset = getETOffsetHours(jan1)
  return makeETDate(jan1, 17, 0, offset)
}

/**
 * Compute all forex period boundaries for the given date in a single call.
 */
export function getForexPeriodBoundaries(date: Date): ForexPeriodBoundaries {
  const todayStart = getForexDayStart(date)

  // Yesterday = one forex day before today
  const beforeToday = new Date(todayStart.getTime() - 1) // 1ms before todayStart
  const yesterdayStart = getForexDayStart(beforeToday)

  return {
    todayStart,
    yesterdayStart,
    yesterdayEnd: todayStart,
    weekStart: getForexWeekStart(date),
    monthStart: getForexMonthStart(date),
    yearStart: getForexYearStart(date),
  }
}

/**
 * Get the start of the most recent active trading session.
 *
 * During market hours (Sun 5 PM–Fri 5 PM ET), returns same as getForexDayStart().
 * During weekends, getForexDayStart() returns Friday 5 PM ET — but no trading
 * happened after that. This returns the previous day start (Thursday 5 PM ET)
 * so queries like "signals today" show the last session's count instead of 0.
 */
export function getLastTradingSessionStart(date: Date): Date {
  if (isWeekendClosed(date)) {
    // Weekend: current forex day started Friday 5 PM but had no activity.
    // Go back to the previous forex day (Thursday 5 PM → Friday 5 PM session).
    const forexDayStart = getForexDayStart(date)
    const beforeForexDay = new Date(forexDayStart.getTime() - 1)
    return getForexDayStart(beforeForexDay)
  }
  return getForexDayStart(date)
}

// ─── Internal helper ──────────────────────────────────────────────────────────

/** Create a UTC Date for a specific ET time on the ET calendar date of the given date. */
function makeETDate(date: Date, etHour: number, etMinute: number, offsetHours: number): Date {
  const etCal = getETCalendarDate(date)
  return new Date(
    Date.UTC(etCal.year, etCal.month - 1, etCal.day, etHour - offsetHours, etMinute, 0, 0),
  )
}
