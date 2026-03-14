"use client"

import { getDecimalPlaces, getPipSize, formatPips } from "@fxflow/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Plus, X, XCircle, Loader2 } from "lucide-react"

interface TradeEditorFormProps {
  instrument: string
  direction: "long" | "short"
  entryPrice: number
  draftSL: number | null
  draftTP: number | null
  savedSL: number | null
  savedTP: number | null
  onSLChange: (val: number | null) => void
  onTPChange: (val: number | null) => void
  onCancel: () => void
  onSave: () => Promise<void>
  /** For open trades: close trade; for pending orders: cancel order */
  onCloseTrade?: () => void
  /** "open" renders "Close Trade", "pending" renders "Cancel Order" */
  variant?: "open" | "pending"
  isSaving: boolean
  isDirty: boolean
  isSLDirty: boolean
  isTPDirty: boolean
  validationErrors: { sl?: string; tp?: string }
  slPips: number | null
  tpPips: number | null
  defaultSL: number
  defaultTP: number
}

export function TradeEditorForm({
  instrument,
  direction,
  entryPrice,
  draftSL,
  draftTP,
  onSLChange,
  onTPChange,
  onCancel,
  onSave,
  onCloseTrade,
  variant = "open",
  isSaving,
  isDirty,
  isSLDirty,
  isTPDirty,
  validationErrors,
  slPips,
  tpPips,
  defaultSL,
  defaultTP,
}: TradeEditorFormProps) {
  const decimals = getDecimalPlaces(instrument)
  const pipSize = getPipSize(instrument)
  const step = pipSize * 0.1
  const hasErrors = Object.keys(validationErrors).length > 0

  return (
    <div className="border-border/50 space-y-3 border-t pt-3">
      {/* Entry (read-only) */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">Entry</span>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {entryPrice.toFixed(decimals)}
        </span>
      </div>

      {/* Stop Loss */}
      {draftSL !== null ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground flex w-6 shrink-0 items-center gap-1 text-xs">
              SL
              {isSLDirty && <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />}
            </span>
            <Input
              type="number"
              step={step}
              value={draftSL}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val)) onSLChange(val)
              }}
              className={cn(
                "h-7 flex-1 font-mono text-xs tabular-nums",
                validationErrors.sl && "border-destructive",
              )}
              aria-label="Stop Loss price"
              aria-invalid={!!validationErrors.sl}
            />
            {slPips !== null && (
              <span className="text-muted-foreground w-12 whitespace-nowrap text-right text-[10px]">
                {formatPips(slPips)}p
              </span>
            )}
            <button
              type="button"
              onClick={() => onSLChange(null)}
              className="text-muted-foreground hover:text-destructive p-0.5 transition-colors"
              aria-label="Remove stop loss"
            >
              <X className="size-3.5" />
            </button>
          </div>
          {validationErrors.sl && (
            <p className="text-destructive pl-8 text-[10px]">{validationErrors.sl}</p>
          )}
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-7 w-full justify-start gap-1 px-2 text-xs"
          onClick={() => onSLChange(defaultSL)}
        >
          <Plus className="size-3" />
          Add Stop Loss
        </Button>
      )}

      {/* Take Profit */}
      {draftTP !== null ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground flex w-6 shrink-0 items-center gap-1 text-xs">
              TP
              {isTPDirty && <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />}
            </span>
            <Input
              type="number"
              step={step}
              value={draftTP}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val)) onTPChange(val)
              }}
              className={cn(
                "h-7 flex-1 font-mono text-xs tabular-nums",
                validationErrors.tp && "border-destructive",
              )}
              aria-label="Take Profit price"
              aria-invalid={!!validationErrors.tp}
            />
            {tpPips !== null && (
              <span className="text-muted-foreground w-12 whitespace-nowrap text-right text-[10px]">
                {formatPips(tpPips)}p
              </span>
            )}
            <button
              type="button"
              onClick={() => onTPChange(null)}
              className="text-muted-foreground hover:text-destructive p-0.5 transition-colors"
              aria-label="Remove take profit"
            >
              <X className="size-3.5" />
            </button>
          </div>
          {validationErrors.tp && (
            <p className="text-destructive pl-8 text-[10px]">{validationErrors.tp}</p>
          )}
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-7 w-full justify-start gap-1 px-2 text-xs"
          onClick={() => onTPChange(defaultTP)}
        >
          <Plus className="size-3" />
          Add Take Profit
        </Button>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={!isDirty || isSaving}
          className="text-xs"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={!isDirty || hasErrors || isSaving}
          className="gap-1.5 text-xs"
        >
          {isSaving && <Loader2 className="size-3 animate-spin" />}
          {isSaving ? "Updating..." : variant === "pending" ? "Update Order" : "Update Trade"}
        </Button>
        <div className="flex-1" />
        {onCloseTrade && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onCloseTrade}
            disabled={isSaving}
            className="gap-1.5 text-xs"
          >
            <XCircle className="size-3.5" />
            {variant === "pending" ? "Cancel Order" : "Close Trade"}
          </Button>
        )}
      </div>
    </div>
  )
}
