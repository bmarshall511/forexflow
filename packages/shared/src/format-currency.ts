/**
 * Currency and P&L formatting utilities.
 *
 * Uses Intl.NumberFormat for locale-aware formatting with dynamic currency support.
 */

/** Format a number as currency (e.g., "$1,234.56", "€1,234.56"). */
export function formatCurrency(value: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

/** Format a P&L value with sign prefix and color intent. */
export function formatPnL(value: number, currency: string = "USD"): FormattedPnL {
  const absFormatted = formatCurrency(Math.abs(value), currency)
  if (value > 0.005) {
    return { formatted: `+${absFormatted}`, colorIntent: "positive" }
  }
  if (value < -0.005) {
    return { formatted: `-${absFormatted}`, colorIntent: "negative" }
  }
  return { formatted: absFormatted, colorIntent: "neutral" }
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
