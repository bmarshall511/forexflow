/**
 * Shared trading-core type primitives.
 *
 * Every module in `trading-core/` operates on these tiny pluggable types so
 * that SmartFlow, EdgeFinder, Trade Finder, and TV Alerts can all consume the
 * same guard/validator/sizer logic without each dragging in their own
 * domain-specific config shapes.
 *
 * @module trading-core/types
 */

/** Canonical direction tag used across all systems. */
export type TradeDirection = "long" | "short"

// Re-export so trading-core consumers get a single home for domain types.
export type { MarketRegime } from "../regime-detector"

/**
 * Minimal position shape needed by correlation guards and exposure checks.
 * Callers adapt their own trade / opportunity rows to this at the call site.
 */
export interface CorrelationPosition {
  instrument: string
  direction: TradeDirection | string
}

/** Uniform result returned by every guard/validator in trading-core. */
export interface GateResult {
  passed: boolean
  reason?: string
}

export const pass = (): GateResult => ({ passed: true })
export const fail = (reason: string): GateResult => ({ passed: false, reason })
