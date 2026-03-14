import { getPipSize } from "@fxflow/shared"
import { cn } from "@/lib/utils"

interface SpreadDisplayProps {
  bid: number
  ask: number
  instrument: string
  className?: string
}

// Typical spreads in pips by category
const MAJOR_PAIRS = new Set([
  "EUR_USD",
  "GBP_USD",
  "USD_JPY",
  "USD_CHF",
  "AUD_USD",
  "NZD_USD",
  "USD_CAD",
])
const MINOR_PAIRS = new Set([
  "EUR_GBP",
  "EUR_JPY",
  "GBP_JPY",
  "EUR_AUD",
  "EUR_CAD",
  "EUR_CHF",
  "GBP_AUD",
  "GBP_CAD",
  "GBP_CHF",
  "AUD_NZD",
  "AUD_CAD",
  "CAD_CHF",
  "NZD_CAD",
  "NZD_CHF",
  "AUD_CHF",
])

function getTypicalSpread(instrument: string): number {
  if (MAJOR_PAIRS.has(instrument)) return 1.5
  if (MINOR_PAIRS.has(instrument)) return 3
  return 7 // exotic
}

function getSpreadColor(spreadPips: number, typicalSpread: number): string {
  if (spreadPips <= typicalSpread * 2) return "text-status-connected"
  if (spreadPips <= typicalSpread * 3) return "text-amber-500"
  return "text-status-disconnected"
}

export function SpreadDisplay({ bid, ask, instrument, className }: SpreadDisplayProps) {
  const pipSize = getPipSize(instrument)
  const spreadPips = (ask - bid) / pipSize
  const typical = getTypicalSpread(instrument)
  const color = getSpreadColor(spreadPips, typical)

  return (
    <span className={cn("font-mono text-xs tabular-nums", color, className)} role="status">
      {spreadPips.toFixed(1)} pips
    </span>
  )
}
