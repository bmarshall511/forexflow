/**
 * Session classifier for Trade Finder — maps current time to a TradeFinderSession bucket.
 * Used for performance tracking by session and session-aware auto-trade gating.
 *
 * @module session-classifier
 */
import type { TradeFinderSession, TradeFinderSessionPreference } from "@fxflow/types"
import { toET } from "./market-hours"

/**
 * Classify the current time into a TradeFinderSession bucket.
 * Uses UTC times mapped to approximate session boundaries.
 *
 * - london_open: 07:00-10:00 UTC (institutional order flow strongest)
 * - london: 10:00-12:00 UTC
 * - ny_open: 12:00-15:00 UTC (NY open + London/NY overlap)
 * - ny: 15:00-17:00 UTC
 * - asian: 00:00-07:00 UTC
 * - off_hours: 17:00-00:00 UTC (thin liquidity)
 */
export function classifySession(date?: Date): TradeFinderSession {
  const d = date ?? new Date()
  const utcHour = d.getUTCHours()

  if (utcHour >= 7 && utcHour < 10) return "london_open"
  if (utcHour >= 10 && utcHour < 12) return "london"
  if (utcHour >= 12 && utcHour < 15) return "ny_open"
  if (utcHour >= 15 && utcHour < 17) return "ny"
  if (utcHour >= 0 && utcHour < 7) return "asian"
  return "off_hours"
}

/** Session quality scores — higher = better for zone-based trading */
const SESSION_QUALITY: Record<TradeFinderSession, number> = {
  london_open: 1.0,
  ny_open: 1.0,
  london: 0.8,
  ny: 0.7,
  asian: 0.5,
  off_hours: 0.2,
}

/** Get a 0-1 quality score for the current session */
export function getSessionQuality(session: TradeFinderSession): number {
  return SESSION_QUALITY[session]
}

/**
 * Evaluate whether auto-trading is allowed based on session preference.
 *
 * - "kill_zones": Only London open, NY open, overlap. Block Asian (except JPY pairs),
 *   Friday post-16:00 UTC, Sunday open.
 * - "all_sessions": Allow all except Sunday open and Friday post-18:00 UTC.
 * - "conservative": Most restrictive — only London/NY overlap and specific kill zones.
 */
export function evaluateSessionForAutoTrade(
  instrument: string,
  preference: TradeFinderSessionPreference,
  date?: Date,
): { allowed: boolean; reason: string; session: TradeFinderSession } {
  const d = date ?? new Date()
  const session = classifySession(d)
  const et = toET(d)
  const dayOfWeek = et.day // 0=Sun, 1=Mon, ... 5=Fri, 6=Sat

  // Universal blocks: Sunday open, Saturday (should be market closed anyway)
  if (dayOfWeek === 0) {
    return { allowed: false, reason: "Sunday — market direction not established", session }
  }
  if (dayOfWeek === 6) {
    return { allowed: false, reason: "Saturday — market closed", session }
  }

  // Monday pre-London block for all modes
  if (dayOfWeek === 1 && d.getUTCHours() < 7) {
    return { allowed: false, reason: "Monday pre-London — gappy open", session }
  }

  if (preference === "all_sessions") {
    // Only block Friday evening
    if (dayOfWeek === 5 && d.getUTCHours() >= 18) {
      return { allowed: false, reason: "Friday evening — thin liquidity ahead of weekend", session }
    }
    return { allowed: true, reason: "", session }
  }

  if (preference === "kill_zones") {
    // Friday afternoon block
    if (dayOfWeek === 5 && d.getUTCHours() >= 16) {
      return { allowed: false, reason: "Friday afternoon — weekend risk", session }
    }

    // Allow London open, NY open
    if (session === "london_open" || session === "ny_open") {
      return { allowed: true, reason: "", session }
    }

    // Allow London (slightly lower quality but still good)
    if (session === "london") {
      return { allowed: true, reason: "", session }
    }

    // Asian only for JPY/AUD/NZD pairs
    if (session === "asian") {
      const [base, quote] = instrument.split("_")
      const asianCurrencies = new Set(["AUD", "NZD", "JPY"])
      if ((base && asianCurrencies.has(base)) || (quote && asianCurrencies.has(quote))) {
        return { allowed: true, reason: "", session }
      }
      return {
        allowed: false,
        reason: `Asian session — ${instrument.replace("_", "/")} not active`,
        session,
      }
    }

    // Off hours and late NY blocked
    return { allowed: false, reason: `Outside kill zone (${session})`, session }
  }

  // "conservative" — most restrictive
  if (dayOfWeek === 5 && d.getUTCHours() >= 14) {
    return { allowed: false, reason: "Friday afternoon — conservative mode", session }
  }

  if (session === "london_open" || session === "ny_open") {
    return { allowed: true, reason: "", session }
  }

  return { allowed: false, reason: `Conservative mode — only London/NY open (${session})`, session }
}
