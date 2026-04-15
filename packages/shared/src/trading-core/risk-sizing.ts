/**
 * Risk-based position sizing.
 *
 * Centralises the `units = riskAmount / (riskPips × pipValuePerUnit)`
 * formula that was duplicated in SmartFlow (`manager.calculatePositionSize`),
 * EdgeFinder (`scanner.executeOpportunity`), and TV Alerts
 * (`signal-processor`). All three had subtly different handling of non-USD
 * quote currencies and `currentPrice` fallbacks.
 *
 * The canonical approximation for pipValuePerUnit:
 *   - USD-quoted pairs (EUR_USD, GBP_USD, …): `pipSize`
 *   - Non-USD-quoted pairs (EUR_GBP, USD_JPY, …): `pipSize / entryPrice`
 *
 * Non-USD-quoted pairs are handled as a linear approximation — for exact
 * USD conversion on cross pairs, callers should use `calculatePipValueUsd`
 * from `pip-value.ts` and pass `pipValuePerUnit` explicitly.
 *
 * @module trading-core/risk-sizing
 */

import { getPipSize } from "../pip-utils"

export type PositionSizeMode = "risk_percent" | "fixed_units" | "fixed_lots" | "kelly"

export interface RiskPercentSizeOpts {
  mode: "risk_percent"
  /** Percent of account balance risked (e.g. 1 for 1%). */
  riskPercent: number
  accountBalance: number
  instrument: string
  /** Risk distance in pips (already computed from SL). */
  riskPips: number
  /** Optional entry price for non-USD-quote conversion. Defaults to 1. */
  entryPrice?: number | null
  /** Optional override for the pip value per unit (cross-pair USD conversion). */
  pipValuePerUnitOverride?: number | null
  /** Minimum units to return when math produces 0. Default 1. */
  minUnits?: number
}

export interface FixedUnitsSizeOpts {
  mode: "fixed_units"
  units: number
  minUnits?: number
}

export interface FixedLotsSizeOpts {
  mode: "fixed_lots"
  lots: number
  minUnits?: number
}

export interface KellySizeOpts {
  mode: "kelly"
  accountBalance: number
  atr: number
  instrument: string
  minUnits?: number
}

export type PositionSizeInput =
  | RiskPercentSizeOpts
  | FixedUnitsSizeOpts
  | FixedLotsSizeOpts
  | KellySizeOpts

/**
 * Deterministic integer units for a position. Never returns less than
 * `minUnits` (default 1) — callers that want to reject zero-size positions
 * should compare against their own floor before placing.
 */
export function calculatePositionSize(input: PositionSizeInput): number {
  const min = Math.max(1, Math.floor(input.minUnits ?? 1))

  switch (input.mode) {
    case "risk_percent": {
      const {
        riskPercent,
        accountBalance,
        instrument,
        riskPips,
        entryPrice,
        pipValuePerUnitOverride,
      } = input
      if (accountBalance <= 0 || riskPips <= 0 || riskPercent <= 0) return min
      const pipSize = getPipSize(instrument)
      const [, quote] = instrument.split("_")
      const isUsdQuote = quote === "USD"
      const pipValuePerUnit =
        pipValuePerUnitOverride ??
        (isUsdQuote ? pipSize : pipSize / Math.max(entryPrice ?? 1, 0.0001))
      if (pipValuePerUnit <= 0) return min
      const riskAmount = accountBalance * (riskPercent / 100)
      const units = Math.floor(riskAmount / (riskPips * pipValuePerUnit))
      return Math.max(min, units)
    }
    case "fixed_units":
      return Math.max(min, Math.floor(input.units))
    case "fixed_lots":
      return Math.max(min, Math.floor(input.lots * 100_000))
    case "kelly": {
      if (input.accountBalance <= 0 || input.atr <= 0) return min
      // Legacy SmartFlow formula — 1% of balance divided by 1.5× ATR (price).
      // Kept for behavioural parity; consider replacing with a real Kelly
      // criterion once we have reliable win-rate data per config.
      return Math.max(min, Math.floor((input.accountBalance * 0.01) / (input.atr * 1.5)))
    }
  }
}
