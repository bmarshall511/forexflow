/**
 * Eastern Time market hours utilities.
 *
 * Forex market: Sun 5:00 PM ET open → Fri 5:00 PM ET close
 * Daily rollover window: 4:59 PM – 5:05 PM ET each trading day
 *
 * All functions accept a Date and work in UTC internally,
 * converting to ET offset (UTC-5 in EST, UTC-4 in EDT).
 */

/** Get current ET offset in hours accounting for DST via Intl API. */
export function getETOffsetHours(date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  })

  const parts = fmt.formatToParts(date)
  const tzPart = parts.find((p) => p.type === "timeZoneName")
  if (!tzPart) return -5 // Fallback to EST

  // tzPart.value is like "GMT-5" or "GMT-4"
  const match = tzPart.value.match(/GMT([+-]\d+)/)
  if (!match?.[1]) return -5
  return parseInt(match[1], 10) || -5
}

interface ETComponents {
  hour: number
  minute: number
  day: number // 0=Sun, 1=Mon, ... 6=Sat
}

/** Convert a UTC Date to ET components (hour, minute, dayOfWeek in ET). */
export function toET(date: Date): ETComponents {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  })

  const parts = fmt.formatToParts(date)
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10)
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10)
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun"

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  return { hour: hour === 24 ? 0 : hour, minute, day: dayMap[weekday] ?? 0 }
}

/**
 * Whether the given UTC time falls within the weekend closure period.
 * Weekend = Friday 5:00 PM ET through Sunday 5:00 PM ET.
 */
export function isWeekendClosed(date: Date): boolean {
  const et = toET(date)

  // Saturday all day = closed
  if (et.day === 6) return true
  // Friday at or after 5:00 PM ET = closed
  if (et.day === 5 && et.hour >= 17) return true
  // Sunday before 5:00 PM ET = closed
  if (et.day === 0 && et.hour < 17) return true

  return false
}

/**
 * Whether the given UTC time falls within the daily rollover window.
 * Rollover = 4:59 PM ET to 5:05 PM ET on trading days (Sun evening–Fri).
 * Note: We exclude weekend hours since isWeekendClosed takes priority.
 */
export function isRolloverWindow(date: Date): boolean {
  if (isWeekendClosed(date)) return false

  const et = toET(date)

  // 4:59 PM ET
  if (et.hour === 16 && et.minute >= 59) return true
  // 5:00–5:04 PM ET
  if (et.hour === 17 && et.minute < 5) return true

  return false
}

/**
 * Whether the market is expected to be open based on schedule alone.
 * This is the client-side fallback when daemon is not available.
 */
export function isMarketExpectedOpen(date: Date): boolean {
  if (isWeekendClosed(date)) return false
  if (isRolloverWindow(date)) return false
  return true
}

/**
 * Get the next expected market state change time.
 *
 * If market is open: returns next close (Fri 5PM ET or next rollover 4:59PM ET).
 * If in weekend: returns Sun 5PM ET.
 * If in rollover: returns rollover end (5:05 PM ET same day).
 */
export function getNextExpectedChange(date: Date): Date {
  const et = toET(date)
  const offsetHours = getETOffsetHours(date)

  if (isWeekendClosed(date)) {
    // Next open = Sunday 5:00 PM ET
    return getNextWeekday(date, 0, 17, 0, offsetHours)
  }

  if (isRolloverWindow(date)) {
    // Rollover ends at 5:05 PM ET same day
    return getTimeToday(date, 17, 5, offsetHours)
  }

  // Market is open (includes Sun evening after 5PM when market just opened).
  // Next change is either:
  // 1. Friday close at 5:00 PM ET (if Friday)
  // 2. Today's rollover at 4:59 PM ET (if before it)
  // 3. Tomorrow's rollover or close (if past today's rollover)

  if (et.day === 5) {
    // Friday: market closes at 5:00 PM ET
    return getTimeToday(date, 17, 0, offsetHours)
  }

  // Next rollover at 4:59 PM ET today (if before it) or tomorrow
  if (et.hour < 16 || (et.hour === 16 && et.minute < 59)) {
    return getTimeToday(date, 16, 59, offsetHours)
  }

  // Past today's rollover (or Sun evening where there was no rollover today)
  const tomorrow = new Date(date)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const tomorrowET = toET(tomorrow)

  if (tomorrowET.day === 5) {
    // Tomorrow is Friday: close at 5PM
    return getTimeOnDate(tomorrow, 17, 0, getETOffsetHours(tomorrow))
  }
  if (tomorrowET.day === 6) {
    // Tomorrow is Saturday: skip to Sunday open
    return getNextWeekday(tomorrow, 0, 17, 0, getETOffsetHours(tomorrow))
  }
  // Normal day: next rollover
  return getTimeOnDate(tomorrow, 16, 59, getETOffsetHours(tomorrow))
}

/** Format countdown between two dates: "1d 23:45:12" or "00:45:12". */
export function formatCountdown(now: Date, target: Date): string {
  const ms = Math.max(0, target.getTime() - now.getTime())
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const hh = String(hours).padStart(2, "0")
  const mm = String(minutes).padStart(2, "0")
  const ss = String(seconds).padStart(2, "0")

  if (days > 0) return `${days}d ${hh}:${mm}:${ss}`
  return `${hh}:${mm}:${ss}`
}

/** Format a date for display: "Fri, Feb 27, 5:00 PM ET". */
export function formatMarketDateTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })
}

/** Compact date for cards: "Mar 9, 2:30 PM". */
export function formatShortDateTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/** Get a Date for a specific ET time today. */
function getTimeToday(date: Date, etHour: number, etMinute: number, offsetHours: number): Date {
  return getTimeOnDate(date, etHour, etMinute, offsetHours)
}

/** Get a Date for a specific ET time on a given date. */
function getTimeOnDate(date: Date, etHour: number, etMinute: number, offsetHours: number): Date {
  const result = new Date(date)
  const utcHour = etHour - offsetHours
  result.setUTCHours(utcHour, etMinute, 0, 0)
  return result
}

/** Get the next occurrence of a specific weekday at a specific ET time. */
function getNextWeekday(
  from: Date,
  targetDay: number,
  etHour: number,
  etMinute: number,
  offsetHours: number,
): Date {
  const result = new Date(from)
  const currentET = toET(from)

  let daysToAdd = (targetDay - currentET.day + 7) % 7
  if (daysToAdd === 0) {
    // Same weekday: check if the target time has passed
    const targetToday = getTimeOnDate(from, etHour, etMinute, offsetHours)
    if (from.getTime() >= targetToday.getTime()) {
      daysToAdd = 7
    }
  }

  result.setUTCDate(result.getUTCDate() + daysToAdd)
  const newOffset = getETOffsetHours(result)
  return getTimeOnDate(result, etHour, etMinute, newOffset)
}
