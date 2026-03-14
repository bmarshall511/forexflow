"use client"

import { useState, useRef, useEffect } from "react"
import { Crosshair, X, ArrowUp, ArrowDown } from "lucide-react"
import { formatInstrument } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { usePositions } from "@/hooks/use-positions"
import type { TradeUnion } from "@/components/positions/trade-editor-panel"

interface PositionPickerProps {
  value: TradeUnion | null
  onChange: (trade: TradeUnion | null) => void
  /** IDs of trades already assigned to other panels */
  assignedIds?: Set<string>
}

export function PositionPicker({ value, onChange, assignedIds }: PositionPickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { positions, openWithPrices } = usePositions()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const pending = positions?.pending ?? []
  const closed = positions?.closed ?? []
  const hasPositions = openWithPrices.length > 0 || pending.length > 0 || closed.length > 0

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
          "hover:bg-muted hover:text-foreground border border-transparent",
          value ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground",
          open && "bg-muted text-foreground border-border",
        )}
        aria-label="Select position to overlay"
        aria-expanded={open}
      >
        <Crosshair className="h-3.5 w-3.5" />
        {value ? (
          <span className="font-medium">
            {formatInstrument(value.instrument)}{" "}
            <span className={value.direction === "long" ? "text-green-500" : "text-red-500"}>
              {value.direction === "long" ? "L" : "S"}
            </span>
          </span>
        ) : (
          <span className="hidden sm:inline">Positions</span>
        )}
      </button>

      {open && (
        <div className="bg-popover absolute left-0 top-full z-50 mt-1 min-w-[240px] max-w-[300px] rounded-lg border shadow-lg">
          {/* Clear button when a trade is selected */}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              className="text-muted-foreground hover:bg-muted flex w-full items-center gap-2 border-b px-3 py-2 text-xs transition-colors"
            >
              <X className="h-3 w-3" />
              Clear selection
            </button>
          )}

          <div className="max-h-72 overflow-y-auto py-1">
            {!hasPositions && (
              <p className="text-muted-foreground px-3 py-4 text-center text-xs">No positions</p>
            )}

            {/* Open trades */}
            {openWithPrices.length > 0 && (
              <Section label="Open">
                {openWithPrices.map((trade) => (
                  <TradeItem
                    key={trade.id}
                    instrument={trade.instrument}
                    direction={trade.direction}
                    entryPrice={trade.entryPrice}
                    pnl={trade.unrealizedPL}
                    isSelected={value?.id === trade.id}
                    isAssigned={assignedIds?.has(trade.id)}
                    onClick={() => {
                      onChange({ ...trade, _type: "open" })
                      setOpen(false)
                    }}
                  />
                ))}
              </Section>
            )}

            {/* Pending orders */}
            {pending.length > 0 && (
              <Section label="Pending">
                {pending.map((order) => (
                  <TradeItem
                    key={order.id}
                    instrument={order.instrument}
                    direction={order.direction}
                    entryPrice={order.entryPrice}
                    isSelected={value?.id === order.id}
                    isAssigned={assignedIds?.has(order.id)}
                    onClick={() => {
                      onChange({ ...order, _type: "pending" })
                      setOpen(false)
                    }}
                  />
                ))}
              </Section>
            )}

            {/* Closed today */}
            {closed.length > 0 && (
              <Section label="Closed Today">
                {closed.map((trade) => (
                  <TradeItem
                    key={trade.id}
                    instrument={trade.instrument}
                    direction={trade.direction}
                    entryPrice={trade.entryPrice}
                    pnl={trade.realizedPL}
                    outcome={trade.outcome}
                    isSelected={value?.id === trade.id}
                    isAssigned={assignedIds?.has(trade.id)}
                    onClick={() => {
                      onChange({ ...trade, _type: "closed" })
                      setOpen(false)
                    }}
                  />
                ))}
              </Section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground px-3 py-1 text-[10px] font-medium uppercase tracking-wider">
        {label}
      </div>
      {children}
    </div>
  )
}

function TradeItem({
  instrument,
  direction,
  entryPrice,
  pnl,
  outcome,
  isSelected,
  isAssigned,
  onClick,
}: {
  instrument: string
  direction: "long" | "short"
  entryPrice: number
  pnl?: number
  outcome?: "win" | "loss" | "breakeven"
  isSelected: boolean
  /** Already assigned to another panel */
  isAssigned?: boolean
  onClick: () => void
}) {
  const decimals = instrument.includes("JPY") ? 3 : 5

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors",
        isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
      )}
    >
      {direction === "long" ? (
        <ArrowUp className="h-3 w-3 shrink-0 text-green-500" />
      ) : (
        <ArrowDown className="h-3 w-3 shrink-0 text-red-500" />
      )}
      <span className="font-medium">{formatInstrument(instrument)}</span>
      <span className="text-muted-foreground ml-auto font-mono tabular-nums">
        {entryPrice.toFixed(decimals)}
      </span>
      {pnl != null && (
        <span
          className={cn(
            "ml-1 font-mono tabular-nums",
            outcome === "win" || (outcome == null && pnl >= 0) ? "text-green-500" : "text-red-500",
          )}
        >
          {pnl >= 0 ? "+" : ""}
          {pnl.toFixed(2)}
        </span>
      )}
      {isAssigned && !isSelected && (
        <span
          className="bg-primary/50 ml-1 h-1.5 w-1.5 shrink-0 rounded-full"
          aria-label="Assigned to a panel"
        />
      )}
    </button>
  )
}
