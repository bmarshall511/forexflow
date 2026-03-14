import type { OpenTradeData } from "@fxflow/types"
import { formatInstrument } from "@fxflow/shared"
import { AlertTriangle } from "lucide-react"

interface CorrelationWarningProps {
  instrument: string
  direction: "long" | "short"
  openTrades: OpenTradeData[]
}

// Hardcoded correlation coefficients for major forex pairs (absolute values).
// Positive = move together, negative stored as positive here with direction flag.
// Only pairs with |correlation| >= 0.7 are included.
const CORRELATION_MAP: Record<string, { pair: string; value: number; inverse: boolean }[]> = {
  EUR_USD: [
    { pair: "GBP_USD", value: 0.87, inverse: false },
    { pair: "AUD_USD", value: 0.75, inverse: false },
    { pair: "NZD_USD", value: 0.73, inverse: false },
    { pair: "USD_CHF", value: 0.92, inverse: true },
    { pair: "USD_CAD", value: 0.74, inverse: true },
  ],
  GBP_USD: [
    { pair: "EUR_USD", value: 0.87, inverse: false },
    { pair: "AUD_USD", value: 0.72, inverse: false },
    { pair: "USD_CHF", value: 0.85, inverse: true },
  ],
  AUD_USD: [
    { pair: "EUR_USD", value: 0.75, inverse: false },
    { pair: "GBP_USD", value: 0.72, inverse: false },
    { pair: "NZD_USD", value: 0.92, inverse: false },
  ],
  NZD_USD: [
    { pair: "AUD_USD", value: 0.92, inverse: false },
    { pair: "EUR_USD", value: 0.73, inverse: false },
  ],
  USD_CHF: [
    { pair: "EUR_USD", value: 0.92, inverse: true },
    { pair: "GBP_USD", value: 0.85, inverse: true },
  ],
  USD_CAD: [
    { pair: "EUR_USD", value: 0.74, inverse: true },
    { pair: "AUD_USD", value: 0.71, inverse: true },
  ],
  USD_JPY: [
    { pair: "EUR_JPY", value: 0.78, inverse: false },
    { pair: "GBP_JPY", value: 0.76, inverse: false },
  ],
  EUR_JPY: [
    { pair: "USD_JPY", value: 0.78, inverse: false },
    { pair: "GBP_JPY", value: 0.91, inverse: false },
  ],
  GBP_JPY: [
    { pair: "EUR_JPY", value: 0.91, inverse: false },
    { pair: "USD_JPY", value: 0.76, inverse: false },
  ],
}

/**
 * Returns true if two trades in the given directions are effectively
 * "same side" exposure given the correlation relationship.
 * Positive correlation + same direction = correlated risk.
 * Inverse correlation + opposite direction = correlated risk.
 */
function isSameExposure(
  newDirection: "long" | "short",
  existingDirection: "long" | "short",
  inverse: boolean,
): boolean {
  const sameDir = newDirection === existingDirection
  return inverse ? !sameDir : sameDir
}

export function CorrelationWarning({ instrument, direction, openTrades }: CorrelationWarningProps) {
  const correlations = CORRELATION_MAP[instrument]
  if (!correlations) return null

  const warnings: { pair: string; correlation: number }[] = []

  for (const corr of correlations) {
    const match = openTrades.find(
      (t) => t.instrument === corr.pair && isSameExposure(direction, t.direction, corr.inverse),
    )
    if (match) {
      warnings.push({ pair: corr.pair, correlation: corr.value })
    }
  }

  if (warnings.length === 0) return null

  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
      <div className="space-y-0.5 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
        {warnings.map((w) => (
          <p key={w.pair}>
            {formatInstrument(instrument)} has {w.correlation.toFixed(2)} correlation with your open{" "}
            {formatInstrument(w.pair)} {direction}
          </p>
        ))}
      </div>
    </div>
  )
}
