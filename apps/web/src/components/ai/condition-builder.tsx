"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type {
  TradeConditionTriggerType,
  TradeConditionActionType,
  TradeConditionData,
} from "@fxflow/types"
import type { CreateConditionInput } from "@/hooks/use-trade-conditions"
import { cn } from "@/lib/utils"
import { AlertTriangle, Info } from "lucide-react"

interface ConditionBuilderProps {
  tradeStatus: string
  onSubmit: (input: CreateConditionInput) => Promise<void>
  onCancel: () => void
  /** Existing active conditions for chain parent selection */
  existingConditions?: TradeConditionData[]
}

const selectClass = cn(
  "flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none",
  "focus:ring-1 focus:ring-ring",
)

const TRIGGER_OPTIONS: {
  value: TradeConditionTriggerType
  label: string
  forStatus: string[]
  description?: string
}[] = [
  { value: "price_breaks_above", label: "Price breaks above", forStatus: ["open", "pending"] },
  { value: "price_breaks_below", label: "Price breaks below", forStatus: ["open", "pending"] },
  { value: "price_reaches", label: "Price reaches (±0.5 pip)", forStatus: ["open", "pending"] },
  { value: "pnl_pips", label: "P&L reaches X pips", forStatus: ["open"] },
  { value: "pnl_currency", label: "P&L reaches $X", forStatus: ["open"] },
  { value: "time_reached", label: "Specific time/date", forStatus: ["open", "pending"] },
  { value: "duration_hours", label: "After X hours open", forStatus: ["open"] },
  {
    value: "trailing_stop",
    label: "Trailing Stop",
    forStatus: ["open"],
    description: "Trail your stop loss behind price as it moves in your favor",
  },
]

const ACTION_OPTIONS: { value: TradeConditionActionType; label: string; forStatus: string[] }[] = [
  { value: "close_trade", label: "Close trade", forStatus: ["open"] },
  { value: "partial_close", label: "Partial close", forStatus: ["open"] },
  { value: "move_stop_loss", label: "Move stop loss", forStatus: ["open", "pending"] },
  { value: "move_take_profit", label: "Move take profit", forStatus: ["open", "pending"] },
  { value: "cancel_order", label: "Cancel order", forStatus: ["pending"] },
  { value: "notify", label: "Send notification", forStatus: ["open", "pending"] },
]

export function ConditionBuilder({
  tradeStatus,
  onSubmit,
  onCancel,
  existingConditions,
}: ConditionBuilderProps) {
  const [triggerType, setTriggerType] = useState<TradeConditionTriggerType>("price_breaks_above")
  const [actionType, setActionType] = useState<TradeConditionActionType>("notify")
  const [label, setLabel] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Trigger value fields
  const [priceValue, setPriceValue] = useState("")
  const [pipsValue, setPipsValue] = useState("")
  const [currencyValue, setCurrencyValue] = useState("")
  const [timestampValue, setTimestampValue] = useState("")
  const [hoursValue, setHoursValue] = useState("")
  const [pnlDirection, setPnlDirection] = useState<"profit" | "loss">("profit")

  // Trailing stop fields
  const [trailDistancePips, setTrailDistancePips] = useState("")
  const [trailStepPips, setTrailStepPips] = useState("")

  // Action params
  const [actionPrice, setActionPrice] = useState("")
  const [actionUnits, setActionUnits] = useState("")

  // Chain parent
  const [parentConditionId, setParentConditionId] = useState("")

  const isTrailingStop = triggerType === "trailing_stop"

  const availableTriggers = TRIGGER_OPTIONS.filter((t) => t.forStatus.includes(tradeStatus))
  const availableActions = ACTION_OPTIONS.filter((a) => a.forStatus.includes(tradeStatus))
  const activeParentOptions = (existingConditions ?? []).filter(
    (c) => c.status === "active" || c.status === "waiting",
  )

  const effectiveActionType = isTrailingStop ? "move_stop_loss" : actionType

  const buildTriggerValue = (): Record<string, unknown> => {
    switch (triggerType) {
      case "price_reaches":
      case "price_breaks_above":
      case "price_breaks_below":
        return { price: parseFloat(priceValue) }
      case "pnl_pips":
        return { pips: parseFloat(pipsValue), direction: pnlDirection }
      case "pnl_currency":
        return { amount: parseFloat(currencyValue), direction: pnlDirection }
      case "time_reached":
        return { timestamp: new Date(timestampValue).toISOString() }
      case "duration_hours":
        return { hours: parseFloat(hoursValue) }
      case "trailing_stop":
        return {
          distance_pips: parseFloat(trailDistancePips),
          ...(trailStepPips ? { step_pips: parseFloat(trailStepPips) } : {}),
        }
    }
  }

  const buildActionParams = (): Record<string, unknown> => {
    if (isTrailingStop) return {}
    switch (effectiveActionType) {
      case "move_stop_loss":
      case "move_take_profit":
        return { price: parseFloat(actionPrice) }
      case "partial_close":
        return { units: parseFloat(actionUnits) }
      default:
        return {}
    }
  }

  const isValid = (): boolean => {
    switch (triggerType) {
      case "price_reaches":
      case "price_breaks_above":
      case "price_breaks_below":
        return !!priceValue && !isNaN(parseFloat(priceValue))
      case "pnl_pips":
        return !!pipsValue && !isNaN(parseFloat(pipsValue)) && parseFloat(pipsValue) > 0
      case "pnl_currency":
        return !!currencyValue && !isNaN(parseFloat(currencyValue)) && parseFloat(currencyValue) > 0
      case "time_reached":
        return !!timestampValue && !isNaN(new Date(timestampValue).getTime())
      case "duration_hours":
        return !!hoursValue && !isNaN(parseFloat(hoursValue)) && parseFloat(hoursValue) > 0
      case "trailing_stop":
        return (
          !!trailDistancePips &&
          !isNaN(parseFloat(trailDistancePips)) &&
          parseFloat(trailDistancePips) > 0
        )
    }
  }

  const handleSubmit = async () => {
    if (!isValid()) return
    setIsSubmitting(true)
    try {
      await onSubmit({
        triggerType,
        triggerValue: buildTriggerValue(),
        actionType: effectiveActionType,
        actionParams: buildActionParams(),
        label: label.trim() || undefined,
        ...(parentConditionId ? { parentConditionId, status: "waiting" as const } : {}),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedTriggerDesc = TRIGGER_OPTIONS.find((t) => t.value === triggerType)?.description

  return (
    <div className="bg-muted/30 space-y-4 rounded-lg border p-4">
      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        New Condition
      </p>

      {/* Label */}
      <div className="space-y-1">
        <Label className="text-xs">Label (optional)</Label>
        <Input
          className="h-8 text-xs"
          placeholder="e.g. Take profit at resistance"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      {/* Trigger */}
      <div className="space-y-2">
        <Label className="text-xs">Trigger</Label>
        <select
          value={triggerType}
          onChange={(e) => setTriggerType(e.target.value as TradeConditionTriggerType)}
          className={selectClass}
        >
          {availableTriggers.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {selectedTriggerDesc && (
          <div className="text-muted-foreground flex items-start gap-1.5 text-[10px]">
            <Info className="mt-0.5 size-3 shrink-0" />
            <span>{selectedTriggerDesc}</span>
          </div>
        )}

        {/* Trigger value inputs */}
        {(triggerType === "price_reaches" ||
          triggerType === "price_breaks_above" ||
          triggerType === "price_breaks_below") && (
          <Input
            type="number"
            step="any"
            className="h-8 text-xs"
            placeholder="Price"
            value={priceValue}
            onChange={(e) => setPriceValue(e.target.value)}
          />
        )}
        {triggerType === "pnl_pips" && (
          <>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 flex-1 text-xs",
                  pnlDirection === "profit" &&
                    "border-emerald-500/40 bg-emerald-500/15 text-emerald-600",
                )}
                onClick={() => setPnlDirection("profit")}
              >
                Profit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 flex-1 text-xs",
                  pnlDirection === "loss" && "border-red-500/40 bg-red-500/15 text-red-600",
                )}
                onClick={() => setPnlDirection("loss")}
              >
                Loss
              </Button>
            </div>
            <Input
              type="number"
              step="any"
              min="0"
              className="h-8 text-xs"
              placeholder={`Pips ${pnlDirection === "profit" ? "in profit" : "in loss"}`}
              value={pipsValue}
              onChange={(e) => setPipsValue(e.target.value)}
            />
          </>
        )}
        {triggerType === "pnl_currency" && (
          <>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 flex-1 text-xs",
                  pnlDirection === "profit" &&
                    "border-emerald-500/40 bg-emerald-500/15 text-emerald-600",
                )}
                onClick={() => setPnlDirection("profit")}
              >
                Profit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 flex-1 text-xs",
                  pnlDirection === "loss" && "border-red-500/40 bg-red-500/15 text-red-600",
                )}
                onClick={() => setPnlDirection("loss")}
              >
                Loss
              </Button>
            </div>
            <Input
              type="number"
              step="any"
              min="0"
              className="h-8 text-xs"
              placeholder={`Amount ${pnlDirection === "profit" ? "in profit" : "in loss"}`}
              value={currencyValue}
              onChange={(e) => setCurrencyValue(e.target.value)}
            />
            <div className="flex items-start gap-1.5 text-[10px] text-amber-600">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              <span>Currency P&amp;L is an approximation for non-USD denominated pairs.</span>
            </div>
          </>
        )}
        {triggerType === "time_reached" && (
          <Input
            type="datetime-local"
            className="h-8 text-xs"
            value={timestampValue}
            onChange={(e) => setTimestampValue(e.target.value)}
          />
        )}
        {triggerType === "duration_hours" && (
          <Input
            type="number"
            step="0.5"
            min="0.5"
            className="h-8 text-xs"
            placeholder="Hours after open"
            value={hoursValue}
            onChange={(e) => setHoursValue(e.target.value)}
          />
        )}
        {triggerType === "trailing_stop" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Distance (pips)</Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                className="h-8 text-xs"
                placeholder="e.g. 15"
                value={trailDistancePips}
                onChange={(e) => setTrailDistancePips(e.target.value)}
              />
              <p className="text-muted-foreground text-[10px]">
                How far behind the current price to place your stop loss
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Minimum Step (pips)</Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                className="h-8 text-xs"
                placeholder="Optional — defaults to distance"
                value={trailStepPips}
                onChange={(e) => setTrailStepPips(e.target.value)}
              />
              <p className="text-muted-foreground text-[10px]">
                Minimum price movement before adjusting stop (defaults to distance)
              </p>
            </div>
          </>
        )}
      </div>

      {/* Action — hidden for trailing_stop since it's implicit */}
      {!isTrailingStop && (
        <div className="space-y-2">
          <Label className="text-xs">Action</Label>
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value as TradeConditionActionType)}
            className={selectClass}
          >
            {availableActions.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>

          {/* Action param inputs */}
          {(actionType === "move_stop_loss" || actionType === "move_take_profit") && (
            <Input
              type="number"
              step="any"
              className="h-8 text-xs"
              placeholder="New price"
              value={actionPrice}
              onChange={(e) => setActionPrice(e.target.value)}
            />
          )}
          {actionType === "partial_close" && (
            <Input
              type="number"
              step="1"
              min="1"
              className="h-8 text-xs"
              placeholder="Units to close"
              value={actionUnits}
              onChange={(e) => setActionUnits(e.target.value)}
            />
          )}
        </div>
      )}

      {isTrailingStop && (
        <div className="text-muted-foreground flex items-start gap-1.5 text-[10px]">
          <Info className="mt-0.5 size-3 shrink-0" />
          <span>Action: Move Stop Loss (automatic for trailing stops)</span>
        </div>
      )}

      {/* Chain parent selector */}
      {activeParentOptions.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">Activate after (optional)</Label>
          <select
            value={parentConditionId}
            onChange={(e) => setParentConditionId(e.target.value)}
            className={selectClass}
          >
            <option value="">Activate immediately</option>
            {activeParentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label ?? `${c.triggerType} → ${c.actionType}`}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-[10px]">
            This condition will wait until the selected condition triggers first.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={() => void handleSubmit()}
          disabled={!isValid() || isSubmitting}
        >
          {isSubmitting ? "Adding..." : "Add Condition"}
        </Button>
      </div>
    </div>
  )
}
