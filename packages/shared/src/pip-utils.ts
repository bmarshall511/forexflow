import type { TradeDirection, TradeOutcome } from "@fxflow/types"

// ─── JPY pair detection ─────────────────────────────────────────────────────

const JPY_PAIRS = new Set([
  "USD_JPY",
  "EUR_JPY",
  "GBP_JPY",
  "AUD_JPY",
  "CAD_JPY",
  "CHF_JPY",
  "NZD_JPY",
  "SGD_JPY",
  "HKD_JPY",
  "ZAR_JPY",
  "TRY_JPY",
  "MXN_JPY",
  "CNH_JPY",
])

/** Returns the pip size for an instrument (0.01 for JPY pairs, 0.0001 for standard). */
export function getPipSize(instrument: string): number {
  return JPY_PAIRS.has(instrument) ? 0.01 : 0.0001
}

/** Returns the display decimal places for an instrument (3 for JPY pairs, 5 for standard). */
export function getDecimalPlaces(instrument: string): number {
  return JPY_PAIRS.has(instrument) ? 3 : 5
}

// ─── Pip calculations ───────────────────────────────────────────────────────

/** Converts an absolute price distance to pips. */
export function priceToPips(instrument: string, priceDistance: number): number {
  const pipSize = getPipSize(instrument)
  return Math.abs(priceDistance) / pipSize
}

/** Calculates distance info between two prices in pips and percentage. */
export function calculateDistanceInfo(
  instrument: string,
  fromPrice: number,
  toPrice: number,
): { pips: number; percentage: number } {
  const distance = toPrice - fromPrice
  const pips = priceToPips(instrument, distance)
  const percentage = fromPrice !== 0 ? Math.abs(distance / fromPrice) * 100 : 0
  return { pips, percentage }
}

// ─── Risk / Reward ──────────────────────────────────────────────────────────

export interface RiskRewardResult {
  /** Ratio string like "2.5:1" (reward:risk), "Protected" when SL is in profit, or null */
  ratio: string | null
  /** Risk in pips (entry to SL, always positive magnitude), or null if no SL */
  riskPips: number | null
  /** Reward in pips (entry to TP, always positive magnitude), or null if no TP */
  rewardPips: number | null
  /** True if neither SL nor TP is set */
  unprotected: boolean
  /** True when SL has moved past entry into profit territory (trailing/breakeven) */
  profitProtected?: boolean
}

/** Calculate risk:reward from entry price, SL, and TP. */
export function calculateRiskReward(
  direction: TradeDirection,
  entryPrice: number,
  stopLoss: number | null,
  takeProfit: number | null,
  instrument: string,
): RiskRewardResult {
  const pipSize = getPipSize(instrument)

  let riskPips: number | null = null
  let rewardPips: number | null = null

  // signedRisk: positive = normal risk (SL below entry for longs), negative = profit locked
  let signedRisk: number | null = null
  if (stopLoss !== null) {
    const riskDistance = direction === "long" ? entryPrice - stopLoss : stopLoss - entryPrice
    signedRisk = riskDistance / pipSize
    riskPips = Math.abs(signedRisk)
  }

  if (takeProfit !== null) {
    const rewardDistance = direction === "long" ? takeProfit - entryPrice : entryPrice - takeProfit
    rewardPips = Math.abs(rewardDistance) / pipSize
  }

  const unprotected = stopLoss === null && takeProfit === null
  // When SL is in profit territory (signedRisk < 0), show "Profit Protected" instead of R:R
  const profitProtected = signedRisk !== null && signedRisk < -0.5
  let ratio: string | null = null

  if (profitProtected) {
    // SL is past entry — trade is profit-protected, R:R is essentially infinite
    ratio = "Protected"
  } else if (riskPips !== null && rewardPips !== null && riskPips > 0) {
    ratio = `${(rewardPips / riskPips).toFixed(1)}:1`
  }

  return { ratio, riskPips, rewardPips, unprotected, profitProtected }
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/** Format pips for display: "45.2" */
export function formatPips(pips: number): string {
  return pips.toFixed(1)
}

/**
 * Determine trade outcome from realized P&L and exit state.
 * Orders that never filled (no exit price, zero P&L) are "cancelled".
 */
export function getTradeOutcome(realizedPL: number, exitPrice?: number | null): TradeOutcome {
  if (realizedPL > 0) return "win"
  if (realizedPL < 0) return "loss"
  if (exitPrice === null || exitPrice === undefined) return "cancelled"
  return "breakeven"
}

/** Format a duration in milliseconds to a human-readable string. */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}
