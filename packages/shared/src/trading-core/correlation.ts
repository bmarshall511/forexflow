/**
 * Currency-correlation guard.
 *
 * Counts how many existing positions would reinforce the same directional
 * currency exposure as a new trade, and blocks it when the cap is hit.
 *
 * Two families of caller exist today:
 *
 * 1. SmartFlow's `checkCorrelation`: "how many *same-exposure* positions are
 *    already open on this currency?" — returns a GateResult.
 * 2. EdgeFinder's `filterCorrelatedSignals`: "here's a sorted list of
 *    candidates, drop the ones that would exceed the cap" — returns a
 *    filtered list.
 *
 * Both are expressible in terms of `countSharedCurrencyExposure()` — the
 * primitive exported here — so we keep one canonical version of the "same
 * exposure" rule and both daemons call through the same code path.
 *
 * @module trading-core/correlation
 */

import type { CorrelationPosition, GateResult, TradeDirection } from "./types"
import { fail, pass } from "./types"

/**
 * Count existing positions that reinforce the same directional exposure as
 * a candidate `(instrument, direction)`.
 *
 * Exposure rule: if any currency of the candidate (base or quote) appears in
 * an existing position's base or quote, AND the net effect on that currency
 * is the same direction, the existing position counts against the cap.
 *
 * Examples — candidate is EUR/USD long (long EUR, short USD):
 *   - EUR/GBP long → long EUR → **counts**
 *   - GBP/EUR short → long EUR → **counts**
 *   - USD/JPY short → long non-USD (short USD) → **counts** (same USD side)
 *   - GBP/JPY long → no shared currency → does not count
 */
export function countSharedCurrencyExposure(
  instrument: string,
  direction: TradeDirection,
  positions: readonly CorrelationPosition[],
): number {
  const [base, quote] = instrument.split("_")
  if (!base || !quote) return 0

  let count = 0
  for (const pos of positions) {
    const [posBase, posQuote] = pos.instrument.split("_")
    if (!posBase || !posQuote) continue
    if (posBase !== base && posBase !== quote && posQuote !== base && posQuote !== quote) continue

    const sameExposure =
      (posBase === base && pos.direction === direction) ||
      (posQuote === quote && pos.direction === direction) ||
      (posBase === quote && pos.direction !== direction) ||
      (posQuote === base && pos.direction !== direction)

    if (sameExposure) count++
  }
  return count
}

/**
 * Guard form: returns a {@link GateResult} that fails when the candidate
 * would push same-currency exposure past `maxPerCurrency`.
 *
 * Replaces SmartFlow's `entry-filters.checkCorrelation`.
 */
export function checkCorrelation(
  instrument: string,
  direction: TradeDirection,
  positions: readonly CorrelationPosition[],
  maxPerCurrency: number,
): GateResult {
  const count = countSharedCurrencyExposure(instrument, direction, positions)
  if (count >= maxPerCurrency) {
    return fail(`${count} correlated positions already open (max ${maxPerCurrency})`)
  }
  return pass()
}

/**
 * Filter form: takes a sorted candidate list and returns only those that
 * fit under `maxPerCurrency`, accumulating their own same-side exposure as
 * we go.
 *
 * Replaces EdgeFinder's `filterCorrelatedSignals` in `ai-trader/scanner.ts`.
 * Callers pass candidates already sorted by priority (best first); this fn
 * keeps the original order and simply skips entries that would exceed the
 * cap on any currency they touch.
 */
export function filterCorrelatedCandidates<
  T extends { instrument: string; direction: TradeDirection },
>(candidates: readonly T[], maxPerCurrency: number): T[] {
  const exposure = new Map<string, number>() // "EUR_long" → count
  const out: T[] = []
  for (const c of candidates) {
    const [base, quote] = c.instrument.split("_")
    if (!base || !quote) continue
    const baseKey = `${base}_${c.direction}`
    const quoteKey = `${quote}_${c.direction === "long" ? "short" : "long"}`
    const baseCount = exposure.get(baseKey) ?? 0
    const quoteCount = exposure.get(quoteKey) ?? 0
    if (baseCount >= maxPerCurrency || quoteCount >= maxPerCurrency) continue
    exposure.set(baseKey, baseCount + 1)
    exposure.set(quoteKey, quoteCount + 1)
    out.push(c)
  }
  return out
}
