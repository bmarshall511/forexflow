/**
 * Adaptive risk:reward multipliers by session and regime.
 *
 * The baseline `minRiskReward` from a config is scaled by two factors:
 *
 *   - **Session** multiplier — kill zones are standard (1.0×), extended
 *     sessions slightly relaxed (0.85×), off-sessions more selective (1.2×).
 *     Rationale: wider spreads and weaker momentum outside kill zones mean
 *     we need a better theoretical R:R to compensate.
 *
 *   - **Regime** multiplier — ranging markets lean on mean-reversion with
 *     smaller targets (0.75×), low-volatility regimes need high conviction
 *     (1.3×), volatile regimes are slightly relaxed (0.9×), trending is
 *     standard (1.0×).
 *
 * Previously lived inside `smart-flow/entry-filters.ts`. EdgeFinder didn't
 * use any session/regime R:R adaptation at all — moving this into
 * trading-core makes it trivially reusable.
 *
 * @module trading-core/rr-multiplier
 */

import { isKillZone } from "../session-utils"
import type { MarketRegime } from "./types"

/**
 * Kill-zone = 1.0×, extended (06-21 UTC) = 0.85×, off-session = 1.2×.
 * Returns a multiplier in the range [0.85, 1.2].
 */
export function getSessionRRMultiplier(date?: Date): number {
  if (isKillZone(date)) return 1.0
  const hour = (date ?? new Date()).getUTCHours()
  if (hour >= 6 && hour < 21) return 0.85
  return 1.2
}

/**
 * Regime-to-multiplier map. Null / unknown regimes default to 1.0.
 */
export function getRegimeRRMultiplier(regime: MarketRegime | string | null): number {
  if (!regime) return 1.0
  switch (regime) {
    case "trending":
      return 1.0
    case "ranging":
      return 0.75
    case "volatile":
      return 0.9
    case "low_volatility":
      return 1.3
    default:
      return 1.0
  }
}

/**
 * Effective minimum R:R for the current context. Floored at 1.0 — we never
 * accept less than 1:1 regardless of regime/session.
 */
export function getAdaptiveMinRR(
  baseMinRR: number,
  regime: MarketRegime | string | null,
  date?: Date,
): number {
  const sessionMul = getSessionRRMultiplier(date)
  const regimeMul = getRegimeRRMultiplier(regime)
  const effective = baseMinRR * sessionMul * regimeMul
  return Math.max(1.0, Math.round(effective * 100) / 100)
}
