/**
 * Currency and P&L formatting utilities.
 *
 * Uses Intl.NumberFormat for locale-aware formatting with dynamic currency support.
 */
import { priceToPips } from "./pip-utils"

/** Format a number as currency (e.g., "$1,234.56", "€1,234.56").
 *  Uses adaptive precision: 4 decimals when |value| is non-zero but < $0.01. */
export function formatCurrency(value: number, currency: string = "USD"): string {
  const absValue = Math.abs(value)
  // Adaptive precision: show 4 decimals for sub-cent amounts so they don't round to $0.00
  const fractionDigits = absValue > 0 && absValue < 0.01 ? 4 : 2
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

/** Color intent for P&L values */
export type PnLColorIntent = "positive" | "negative" | "neutral"

/** Formatted P&L with display string and color intent */
export interface FormattedPnL {
  /** Formatted string with sign prefix (e.g., "+$1,234.56", "-$789.00") */
  formatted: string
  /** Color intent for UI styling */
  colorIntent: PnLColorIntent
}

/** Format a P&L value with sign prefix and color intent.
 *  Color and sign are based on the raw value — even sub-cent amounts show direction. */
export function formatPnL(value: number, currency: string = "USD"): FormattedPnL {
  const absFormatted = formatCurrency(Math.abs(value), currency)
  // Use a tiny epsilon to avoid floating-point noise (e.g., -0.0000001 from rounding)
  if (value > 1e-8) {
    return { formatted: `+${absFormatted}`, colorIntent: "positive" }
  }
  if (value < -1e-8) {
    return { formatted: `-${absFormatted}`, colorIntent: "negative" }
  }
  return { formatted: absFormatted, colorIntent: "neutral" }
}

/** Formatted P&L with both dollar and pip representations. */
export interface FormattedPnLWithPips extends FormattedPnL {
  /** Pip distance with sign (e.g., "+8.1p", "-3.5p") */
  pips: string
  /** Raw pip value for sorting/comparison */
  rawPips: number
}

/** Format P&L with both dollar amount and pip distance.
 *  Pips are always meaningful regardless of position size. */
export function formatPnLWithPips(
  unrealizedPL: number,
  instrument: string,
  direction: "long" | "short",
  entryPrice: number,
  currentPrice: number,
  currency: string = "USD",
): FormattedPnLWithPips {
  const base = formatPnL(unrealizedPL, currency)
  const priceDistance = currentPrice - entryPrice
  const signedPips = direction === "long" ? priceDistance : -priceDistance
  const absPips = priceToPips(instrument, Math.abs(priceDistance))
  const sign = signedPips > 0 ? "+" : signedPips < 0 ? "-" : ""
  return {
    ...base,
    pips: `${sign}${absPips.toFixed(1)}p`,
    rawPips: signedPips > 0 ? absPips : signedPips < 0 ? -absPips : 0,
  }
}

/** Format a relative time (e.g., "5s ago", "2m ago", "1h ago"). */
export function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "Never"
  const diff = Date.now() - new Date(isoString).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}
