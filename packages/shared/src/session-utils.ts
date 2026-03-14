// Forex session utilities — pure TypeScript, no runtime-specific imports.
import { toET } from "./market-hours"

/** Major forex trading sessions and their overlaps. */
export type ForexSession =
  | "asian"
  | "london"
  | "ny"
  | "london_ny_overlap"
  | "london_close"
  | "off_session"

/** Information about the current forex trading session. */
export interface SessionInfo {
  /** The active session identifier. */
  session: ForexSession
  /** Whether the current time falls within a high-volume kill zone. */
  isKillZone: boolean
  /** Currency pairs that typically see the highest volume during this session. */
  bestPairs: string[]
  /** Session start hour in Eastern Time. */
  startHourET: number
  /** Session end hour in Eastern Time. */
  endHourET: number
}

interface SessionWindow {
  session: ForexSession
  start: number
  end: number
  killZone: boolean
}

const SESSION_WINDOWS: SessionWindow[] = [
  { session: "london_ny_overlap", start: 8, end: 12, killZone: true },
  { session: "london_close", start: 10, end: 12, killZone: false },
  { session: "london", start: 2, end: 5, killZone: true },
  { session: "ny", start: 7, end: 10, killZone: true },
  { session: "asian", start: 19, end: 22, killZone: true },
]

const SESSION_PAIRS: Record<ForexSession, string[]> = {
  asian: ["AUD_USD", "NZD_USD", "USD_JPY", "AUD_JPY", "NZD_JPY"],
  london: ["EUR_USD", "GBP_USD", "EUR_GBP", "USD_CHF", "GBP_JPY"],
  ny: ["EUR_USD", "USD_CAD", "GBP_USD", "USD_JPY", "USD_CHF"],
  london_ny_overlap: [
    "EUR_USD",
    "GBP_USD",
    "USD_JPY",
    "USD_CHF",
    "USD_CAD",
    "AUD_USD",
    "NZD_USD",
    "EUR_GBP",
    "GBP_JPY",
  ],
  london_close: ["EUR_USD", "GBP_USD", "EUR_GBP"],
  off_session: [],
}

function isInWindow(hour: number, start: number, end: number): boolean {
  if (start <= end) return hour >= start && hour < end
  // Wraps past midnight (e.g., Asian 19-22 doesn't wrap, but if it did)
  return hour >= start || hour < end
}

function findWindow(hourET: number): SessionWindow | undefined {
  // Check overlap first (more specific), then others
  return SESSION_WINDOWS.find((w) => isInWindow(hourET, w.start, w.end))
}

/**
 * Determine which forex session is active for a given hour in Eastern Time.
 *
 * @param hoursET - Hour of the day in Eastern Time (0-23).
 * @returns The active session, or "off_session" if outside all session windows.
 */
export function getSessionForTime(hoursET: number): ForexSession {
  const window = findWindow(hoursET)
  return window?.session ?? "off_session"
}

/**
 * Get full session information for the current (or specified) time.
 * Returns the active session, kill zone status, and recommended currency pairs.
 *
 * @param date - Date to check (defaults to now).
 * @returns Session information including best pairs for the active session.
 */
export function getCurrentSession(date?: Date): SessionInfo {
  const d = date ?? new Date()
  const et = toET(d)
  const hourFraction = et.hour + et.minute / 60
  const window = findWindow(hourFraction)
  const session = window?.session ?? "off_session"

  return {
    session,
    isKillZone: window?.killZone ?? false,
    bestPairs: SESSION_PAIRS[session],
    startHourET: window?.start ?? 0,
    endHourET: window?.end ?? 0,
  }
}

/**
 * Check whether the current (or specified) time falls within a kill zone.
 * Kill zones are high-volume windows where institutional order flow is strongest.
 *
 * @param date - Date to check (defaults to now).
 * @returns True if in a kill zone.
 */
export function isKillZone(date?: Date): boolean {
  return getCurrentSession(date).isKillZone
}

/**
 * Get the recommended currency pairs for a given forex session.
 *
 * @param session - The forex session to query.
 * @returns Array of OANDA instrument names (e.g., "EUR_USD") that are most liquid during the session.
 */
export function getSessionBestPairs(session: ForexSession): string[] {
  return SESSION_PAIRS[session]
}

/**
 * Score how well-suited an instrument is for trading during a given session.
 * Direct matches score highest (90), partial currency overlap scores lower.
 *
 * @param instrument - OANDA instrument name (e.g., "EUR_USD").
 * @param session - The forex session to evaluate against.
 * @returns Score from 10 (off-session) to 90 (direct match).
 */
export function getSessionScore(instrument: string, session: ForexSession): number {
  const pairs = SESSION_PAIRS[session]
  if (pairs.length === 0) return 10 // Off-session: minimal score

  // Direct match = highest score
  if (pairs.includes(instrument)) return 90

  // Check if the instrument's base or quote currency is active in this session
  const [base, quote] = instrument.split("_")
  const sessionCurrencies = new Set(pairs.flatMap((p) => p.split("_")))
  const baseMatch = base ? sessionCurrencies.has(base) : false
  const quoteMatch = quote ? sessionCurrencies.has(quote) : false

  if (baseMatch && quoteMatch) return 70
  if (baseMatch || quoteMatch) return 45
  return 20
}
