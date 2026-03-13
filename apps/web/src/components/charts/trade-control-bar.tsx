"use client"

import { ArrowUp, ArrowDown, X, Plus, Loader2 } from "lucide-react"
import { getDecimalPlaces, getPipSize, formatPips, formatInstrument, priceToPips } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { UseChartTradeEditorReturn } from "@/hooks/use-chart-trade-editor"
import type { TradeUnion } from "@/components/positions/trade-editor-panel"

interface TradeControlBarProps {
  trade: TradeUnion
  editor: UseChartTradeEditorReturn
  currentPrice: number | null
  onClear: () => void
}

export function TradeControlBar({ trade, editor, currentPrice, onClear }: TradeControlBarProps) {
  const decimals = getDecimalPlaces(trade.instrument)
  const pipSize = getPipSize(trade.instrument)
  const step = pipSize * 0.1
  const hasErrors = Object.keys(editor.validationErrors).length > 0
  const isEditable = trade._type !== "closed"

  return (
    <div className="flex items-center gap-2 px-3 py-1 border-t shrink-0 min-h-[36px] overflow-x-auto scrollbar-none">
      {/* Trade identity */}
      <div className="flex items-center gap-1.5 shrink-0">
        {trade.direction === "long" ? (
          <ArrowUp className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5 text-red-500" />
        )}
        <span className="text-xs font-semibold">{formatInstrument(trade.instrument)}</span>
        <span
          className={cn(
            "px-1 py-0.5 text-[10px] font-medium rounded",
            trade.direction === "long"
              ? "bg-green-500/10 text-green-500"
              : "bg-red-500/10 text-red-500",
          )}
        >
          {trade.direction === "long" ? "Long" : "Short"}
        </span>
      </div>

      <div className="w-px h-5 bg-border shrink-0" />

      {/* Entry (read-only) */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] text-muted-foreground">Entry</span>
        <span className="text-xs font-mono tabular-nums">{trade.entryPrice.toFixed(decimals)}</span>
      </div>

      <div className="w-px h-5 bg-border shrink-0" />

      {isEditable ? (
        <>
          {/* SL input */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              SL
              {editor.isSLDirty && <span className="size-1.5 rounded-full bg-amber-500" />}
            </span>
            {editor.draftSL !== null ? (
              <>
                <Input
                  type="number"
                  step={step}
                  value={editor.draftSL}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val)) editor.setDraftSL(val)
                  }}
                  className={cn(
                    "h-6 w-24 text-xs font-mono tabular-nums",
                    editor.validationErrors.sl && "border-destructive",
                  )}
                  aria-label="Stop Loss price"
                  aria-invalid={!!editor.validationErrors.sl}
                  onClick={(e) => e.stopPropagation()}
                />
                {editor.slPips !== null && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatPips(editor.slPips)}p
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); editor.setDraftSL(null) }}
                  className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                  aria-label="Remove stop loss"
                >
                  <X className="size-3" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); editor.setDraftSL(editor.defaultSL) }}
                className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="size-3" />
                Add
              </button>
            )}
          </div>

          <div className="w-px h-5 bg-border shrink-0" />

          {/* TP input */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              TP
              {editor.isTPDirty && <span className="size-1.5 rounded-full bg-amber-500" />}
            </span>
            {editor.draftTP !== null ? (
              <>
                <Input
                  type="number"
                  step={step}
                  value={editor.draftTP}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val)) editor.setDraftTP(val)
                  }}
                  className={cn(
                    "h-6 w-24 text-xs font-mono tabular-nums",
                    editor.validationErrors.tp && "border-destructive",
                  )}
                  aria-label="Take Profit price"
                  aria-invalid={!!editor.validationErrors.tp}
                  onClick={(e) => e.stopPropagation()}
                />
                {editor.tpPips !== null && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatPips(editor.tpPips)}p
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); editor.setDraftTP(null) }}
                  className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                  aria-label="Remove take profit"
                >
                  <X className="size-3" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); editor.setDraftTP(editor.defaultTP) }}
                className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="size-3" />
                Add
              </button>
            )}
          </div>

          <div className="w-px h-5 bg-border shrink-0" />

          {/* Inline progress bar */}
          {trade._type === "open" && (
            <InlineProgressBar
              instrument={trade.instrument}
              direction={trade.direction}
              entryPrice={trade.entryPrice}
              currentPrice={currentPrice}
              stopLoss={editor.draftSL}
              takeProfit={editor.draftTP}
            />
          )}

          {/* Save/Cancel */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); editor.cancel() }}
              disabled={!editor.isDirty || editor.isSaving}
              className="h-6 text-[10px] px-2"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={(e) => { e.stopPropagation(); editor.save() }}
              disabled={!editor.isDirty || hasErrors || editor.isSaving}
              className="h-6 text-[10px] px-2 gap-1"
            >
              {editor.isSaving && <Loader2 className="size-3 animate-spin" />}
              {editor.isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </>
      ) : (
        /* Closed trade: read-only info */
        <>
          {trade._type === "closed" && (
            <>
              {trade.stopLoss != null && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-muted-foreground">SL</span>
                  <span className="text-xs font-mono tabular-nums">{trade.stopLoss.toFixed(decimals)}</span>
                </div>
              )}
              {trade.takeProfit != null && (
                <>
                  <div className="w-px h-5 bg-border shrink-0" />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground">TP</span>
                    <span className="text-xs font-mono tabular-nums">{trade.takeProfit.toFixed(decimals)}</span>
                  </div>
                </>
              )}
              {trade.exitPrice != null && (
                <>
                  <div className="w-px h-5 bg-border shrink-0" />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground">Exit</span>
                    <span className="text-xs font-mono tabular-nums">{trade.exitPrice.toFixed(decimals)}</span>
                  </div>
                </>
              )}
              <div className="w-px h-5 bg-border shrink-0" />
              <span
                className={cn(
                  "text-xs font-medium",
                  trade.outcome === "win" ? "text-green-500"
                    : trade.outcome === "loss" ? "text-red-500"
                      : "text-muted-foreground",
                )}
              >
                {trade.realizedPL >= 0 ? "+" : ""}{trade.realizedPL.toFixed(2)}
              </span>
            </>
          )}
          <div className="ml-auto" />
        </>
      )}

      {/* Dismiss */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClear() }}
        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="Dismiss trade"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/** Compact inline progress bar for open trades */
function InlineProgressBar({
  instrument,
  direction,
  entryPrice,
  currentPrice,
  stopLoss,
  takeProfit,
}: {
  instrument: string
  direction: "long" | "short"
  entryPrice: number
  currentPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
}) {
  if (!stopLoss && !takeProfit) return null

  const slPips = stopLoss ? Math.abs(priceToPips(instrument, entryPrice - stopLoss)) : null
  const tpPips = takeProfit ? Math.abs(priceToPips(instrument, takeProfit - entryPrice)) : null
  const totalRange = (slPips ?? 0) + (tpPips ?? 0)
  if (totalRange === 0) return null

  let currentPips = 0
  if (currentPrice) {
    const raw = priceToPips(instrument, currentPrice - entryPrice)
    currentPips = direction === "long" ? raw : -raw
  }

  const slSide = slPips ?? totalRange / 2
  const progress = ((currentPips + slSide) / totalRange) * 100
  const clampedProgress = Math.max(0, Math.min(100, progress))

  return (
    <div className="relative w-24 h-2 rounded-full bg-muted overflow-hidden shrink-0">
      {slPips !== null && (
        <div
          className="absolute inset-y-0 left-0 bg-red-500/20 rounded-l-full"
          style={{ width: `${(slPips / totalRange) * 100}%` }}
        />
      )}
      {tpPips !== null && (
        <div
          className="absolute inset-y-0 right-0 bg-green-500/20 rounded-r-full"
          style={{ width: `${(tpPips / totalRange) * 100}%` }}
        />
      )}
      {slPips !== null && (
        <div
          className="absolute inset-y-0 w-px bg-foreground/30"
          style={{ left: `${(slPips / totalRange) * 100}%` }}
        />
      )}
      <div
        className={cn(
          "absolute top-0 h-full w-1.5 rounded-full transition-all duration-300",
          currentPips >= 0 ? "bg-green-500" : "bg-red-500",
        )}
        style={{ left: `calc(${clampedProgress}% - 3px)` }}
      />
    </div>
  )
}
