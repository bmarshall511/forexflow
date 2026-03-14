"use client"

import { useMemo } from "react"
import { getDecimalPlaces, priceToPips, formatPips } from "@fxflow/shared"
import { cn } from "@/lib/utils"

interface OrderEntryOverlayProps {
  bid: number | null
  ask: number | null
  instrument: string
  onBuy: () => void
  onSell: () => void
}

export function OrderEntryOverlay({ bid, ask, instrument, onBuy, onSell }: OrderEntryOverlayProps) {
  const decimals = getDecimalPlaces(instrument)
  const hasPrices = bid !== null && ask !== null

  const spreadPips = useMemo(() => {
    if (bid === null || ask === null) return null
    return priceToPips(instrument, ask - bid)
  }, [bid, ask, instrument])

  return (
    <div
      className={cn(
        "border-border/50 absolute bottom-3 right-3 z-20 flex items-center gap-0 overflow-hidden rounded-lg border shadow-lg backdrop-blur-sm",
        !hasPrices && "opacity-50",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Sell button */}
      <button
        type="button"
        onClick={onSell}
        disabled={!hasPrices}
        className={cn(
          "flex flex-col items-center px-3 py-1.5 transition-colors",
          "bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30",
          "border-border/30 border-r",
          "disabled:pointer-events-none",
        )}
        aria-label={
          hasPrices ? `Sell ${instrument} at ${bid!.toFixed(decimals)}` : `Sell ${instrument}`
        }
      >
        <span className="text-[9px] font-medium uppercase tracking-wide text-red-400">Sell</span>
        <span className="font-mono text-sm font-semibold tabular-nums text-red-500">
          {hasPrices ? bid!.toFixed(decimals) : "—"}
        </span>
      </button>

      {/* Spread */}
      <div className="bg-background/80 flex flex-col items-center justify-center px-2 py-1.5">
        <span className="text-muted-foreground font-mono text-[9px] tabular-nums">
          {spreadPips !== null ? formatPips(spreadPips) : "—"}
        </span>
      </div>

      {/* Buy button */}
      <button
        type="button"
        onClick={onBuy}
        disabled={!hasPrices}
        className={cn(
          "flex flex-col items-center px-3 py-1.5 transition-colors",
          "bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30",
          "border-border/30 border-l",
          "disabled:pointer-events-none",
        )}
        aria-label={
          hasPrices ? `Buy ${instrument} at ${ask!.toFixed(decimals)}` : `Buy ${instrument}`
        }
      >
        <span className="text-[9px] font-medium uppercase tracking-wide text-blue-400">Buy</span>
        <span className="font-mono text-sm font-semibold tabular-nums text-blue-500">
          {hasPrices ? ask!.toFixed(decimals) : "—"}
        </span>
      </button>
    </div>
  )
}
