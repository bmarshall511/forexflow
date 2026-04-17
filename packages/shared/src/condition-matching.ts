/**
 * Shared parameter-based fuzzy matching for trade conditions.
 *
 * Used by both the daemon (when auto-applying AI suggestions) and the web UI
 * (when rendering "already applied" state on suggestion cards). Keeping the
 * logic in one place prevents the two sides from drifting apart — which was
 * the root cause of duplicate AI condition suggestions appearing in the UI
 * even when the daemon had already deduped them server-side.
 *
 * Matching is deliberately tolerant:
 *  - Labels are ignored (the AI phrases the same rule many ways).
 *  - Numeric price values match within a pip-aware tolerance — "184.868" and
 *    "184.870" are the same level to a trader.
 *  - Numeric percent/pip distances match within small epsilons.
 *  - Non-numeric params are compared exactly after normalization.
 *
 * @module condition-matching
 */

import { getPipSize } from "./pip-utils"

// ─── Tolerances ─────────────────────────────────────────────────────────────

/**
 * Number of pips of tolerance for price-based trigger/action values.
 * 2 pips is the "same level" threshold a professional trader would use —
 * sub-pip differences from rounding or quote-side shifts should match.
 */
const PRICE_TOLERANCE_PIPS = 2

/** Tolerance for percentage-based params (absolute percentage points). */
const PERCENT_TOLERANCE_POINTS = 0.1

/** Tolerance for pip-distance params (absolute pips). */
const PIP_DISTANCE_TOLERANCE = 3

/** Tolerance for currency P&L params (absolute USD — or whatever account currency). */
const CURRENCY_TOLERANCE = 1

/** Tolerance for time-based triggers (seconds). */
const TIME_TOLERANCE_MS = 60_000

// ─── Public types (structural, not tied to DB) ──────────────────────────────

export interface ConditionLike {
  triggerType: string
  triggerValue: unknown
  actionType: string
  actionParams?: unknown
}

export interface ConditionMatchOptions {
  /**
   * Instrument of the trade — required for pip-aware price tolerance.
   * If omitted, falls back to a conservative non-JPY tolerance.
   */
  instrument?: string
}

// ─── Key classification ─────────────────────────────────────────────────────

const PRICE_KEYS = new Set([
  "price",
  "targetPrice",
  "target",
  "triggerPrice",
  "stopLoss",
  "takeProfit",
  "newStopLoss",
  "newTakeProfit",
  "newPrice",
  "entryPrice",
  "stop",
  "tp",
  "sl",
])

const PERCENT_KEYS = new Set(["percent", "percentage", "pctOfRemaining"])

const PIP_DISTANCE_KEYS = new Set([
  "pips",
  "distance_pips",
  "distancePips",
  "step_pips",
  "stepPips",
  "offsetPips",
  "offset_pips",
])

const CURRENCY_KEYS = new Set(["currency", "pnl", "profit", "loss", "amount_usd", "amountUsd"])

const TIME_KEYS = new Set(["time", "timestamp", "at", "triggerTime"])

const DURATION_KEYS = new Set(["hours", "duration_hours", "durationHours", "minutes"])

// ─── Comparison helpers ─────────────────────────────────────────────────────

function normalizeString(v: unknown): string | null {
  if (typeof v !== "string") return null
  return v.trim().toLowerCase()
}

function approxEqual(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance
}

function priceTolerance(instrument: string | undefined): number {
  const pipSize = instrument ? getPipSize(instrument) : 0.0001
  return PRICE_TOLERANCE_PIPS * pipSize
}

/**
 * Recursively compare two JSON-parsed objects with key-aware numeric tolerance.
 * Returns true if they represent the same condition parameters within tolerance.
 */
function valuesMatch(
  a: unknown,
  b: unknown,
  opts: ConditionMatchOptions,
  keyHint?: string,
): boolean {
  // Null/undefined equivalence
  if (a == null && b == null) return true
  if (a == null || b == null) return false

  // Same primitive types
  if (typeof a !== typeof b) {
    // Numeric strings should match numbers — AI sometimes serializes either way
    const na = typeof a === "string" ? Number(a) : typeof a === "number" ? a : NaN
    const nb = typeof b === "string" ? Number(b) : typeof b === "number" ? b : NaN
    if (Number.isFinite(na) && Number.isFinite(nb)) {
      return numberMatch(na, nb, opts, keyHint)
    }
    return false
  }

  if (typeof a === "number" && typeof b === "number") {
    return numberMatch(a, b, opts, keyHint)
  }

  if (typeof a === "string" && typeof b === "string") {
    const na = normalizeString(a)
    const nb = normalizeString(b)
    return na === nb
  }

  if (typeof a === "boolean" && typeof b === "boolean") {
    return a === b
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((el, i) => valuesMatch(el, b[i], opts, keyHint))
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>
    const aKeys = Object.keys(aObj).sort()
    const bKeys = Object.keys(bObj).sort()
    if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) return false
    return aKeys.every((k) => valuesMatch(aObj[k], bObj[k], opts, k))
  }

  return false
}

function numberMatch(a: number, b: number, opts: ConditionMatchOptions, keyHint?: string): boolean {
  if (keyHint && PRICE_KEYS.has(keyHint)) {
    return approxEqual(a, b, priceTolerance(opts.instrument))
  }
  if (keyHint && PERCENT_KEYS.has(keyHint)) {
    return approxEqual(a, b, PERCENT_TOLERANCE_POINTS)
  }
  if (keyHint && PIP_DISTANCE_KEYS.has(keyHint)) {
    return approxEqual(a, b, PIP_DISTANCE_TOLERANCE)
  }
  if (keyHint && CURRENCY_KEYS.has(keyHint)) {
    return approxEqual(a, b, CURRENCY_TOLERANCE)
  }
  if (keyHint && TIME_KEYS.has(keyHint)) {
    return approxEqual(a, b, TIME_TOLERANCE_MS)
  }
  if (keyHint && DURATION_KEYS.has(keyHint)) {
    return approxEqual(a, b, 0.25) // 15 min tolerance on durations
  }
  // Default: tight absolute tolerance for unknown numeric fields
  return approxEqual(a, b, Math.max(Math.abs(a), Math.abs(b)) * 0.001 + 1e-9)
}

function parseMaybeJson(v: unknown): unknown {
  if (typeof v === "string") {
    const trimmed = v.trim()
    if (!trimmed) return v
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed)
      } catch {
        return v
      }
    }
  }
  return v
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Return true if two conditions represent the same rule within tolerance.
 *
 * Compares `triggerType` + `actionType` exactly, and `triggerValue` +
 * `actionParams` with key-aware numeric tolerance. Labels are ignored.
 *
 * @param a First condition
 * @param b Second condition
 * @param opts Matching options (e.g., instrument for pip-aware price tolerance)
 */
export function conditionsMatch(
  a: ConditionLike,
  b: ConditionLike,
  opts: ConditionMatchOptions = {},
): boolean {
  if (a.triggerType !== b.triggerType) return false
  if (a.actionType !== b.actionType) return false

  const triggerMatch = valuesMatch(
    parseMaybeJson(a.triggerValue),
    parseMaybeJson(b.triggerValue),
    opts,
  )
  if (!triggerMatch) return false

  const actionMatch = valuesMatch(
    parseMaybeJson(a.actionParams ?? {}),
    parseMaybeJson(b.actionParams ?? {}),
    opts,
  )
  return actionMatch
}

/**
 * Find the first existing condition that matches the given candidate, or
 * `undefined` if none match. O(n) — acceptable because conditions-per-trade
 * is small (single digits in practice).
 */
export function findMatchingCondition<T extends ConditionLike>(
  candidate: ConditionLike,
  existing: readonly T[],
  opts: ConditionMatchOptions = {},
): T | undefined {
  return existing.find((c) => conditionsMatch(candidate, c, opts))
}
