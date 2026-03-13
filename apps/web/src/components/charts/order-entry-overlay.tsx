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
        "absolute bottom-3 right-3 z-20 flex items-center gap-0 rounded-lg overflow-hidden shadow-lg border border-border/50 backdrop-blur-sm",
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
          "border-r border-border/30",
          "disabled:pointer-events-none",
        )}
        aria-label={hasPrices ? `Sell ${instrument} at ${bid!.toFixed(decimals)}` : `Sell ${instrument}`}
      >
        <span className="text-[9px] font-medium text-red-400 uppercase tracking-wide">Sell</span>
        <span className="text-sm font-mono tabular-nums font-semibold text-red-500">
          {hasPrices ? bid!.toFixed(decimals) : "—"}
        </span>
      </button>

      {/* Spread */}
      <div className="flex flex-col items-center justify-center px-2 py-1.5 bg-background/80">
        <span className="text-[9px] font-mono tabular-nums text-muted-foreground">
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
          "border-l border-border/30",
          "disabled:pointer-events-none",
        )}
        aria-label={hasPrices ? `Buy ${instrument} at ${ask!.toFixed(decimals)}` : `Buy ${instrument}`}
      >
        <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wide">Buy</span>
        <span className="text-sm font-mono tabular-nums font-semibold text-blue-500">
          {hasPrices ? ask!.toFixed(decimals) : "—"}
        </span>
      </button>
    </div>
  )
}
