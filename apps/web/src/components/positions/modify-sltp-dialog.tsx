"use client"

import { useState, useEffect, useMemo } from "react"
import type { OpenTradeData } from "@fxflow/types"
import { priceToPips, formatPips } from "@fxflow/shared"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DirectionBadge } from "./direction-badge"

interface ModifySltpDialogProps {
  trade: OpenTradeData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (stopLoss: number | null, takeProfit: number | null) => void
  isLoading: boolean
  /** Pre-fill SL input with this value instead of trade.stopLoss (e.g. AI suggestion) */
  initialSl?: number
  /** Pre-fill TP input with this value instead of trade.takeProfit (e.g. AI suggestion) */
  initialTp?: number
}

export function ModifySltpDialog({
  trade,
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  initialSl,
  initialTp,
}: ModifySltpDialogProps) {
  const [slValue, setSlValue] = useState("")
  const [tpValue, setTpValue] = useState("")
  const [removeSl, setRemoveSl] = useState(false)
  const [removeTp, setRemoveTp] = useState(false)

  useEffect(() => {
    if (trade && open) {
      setSlValue((initialSl ?? trade.stopLoss)?.toString() ?? "")
      setTpValue((initialTp ?? trade.takeProfit)?.toString() ?? "")
      setRemoveSl(false)
      setRemoveTp(false)
    }
  }, [trade, open]) // eslint-disable-line react-hooks/exhaustive-deps -- initialSl/initialTp are set before open

  const slPips = useMemo(() => {
    if (!trade || removeSl || !slValue) return null
    const sl = parseFloat(slValue)
    if (isNaN(sl)) return null
    return priceToPips(trade.instrument, Math.abs(sl - trade.entryPrice))
  }, [trade, slValue, removeSl])

  const tpPips = useMemo(() => {
    if (!trade || removeTp || !tpValue) return null
    const tp = parseFloat(tpValue)
    if (isNaN(tp)) return null
    return priceToPips(trade.instrument, Math.abs(tp - trade.entryPrice))
  }, [trade, tpValue, removeTp])

  if (!trade) return null

  const pair = trade.instrument.replace("_", "/")

  const handleConfirm = () => {
    const sl = removeSl ? null : slValue ? parseFloat(slValue) : undefined
    const tp = removeTp ? null : tpValue ? parseFloat(tpValue) : undefined

    // When pre-filled with AI suggestions, always send — user is confirming a recommendation
    const hasInitialValues = initialSl !== undefined || initialTp !== undefined

    if (!hasInitialValues) {
      // Only send values that actually changed (normal manual edit flow)
      const slArg = removeSl ? null : sl !== undefined && sl !== trade.stopLoss ? sl : undefined
      const tpArg = removeTp ? null : tp !== undefined && tp !== trade.takeProfit ? tp : undefined

      if (slArg === undefined && tpArg === undefined) {
        onOpenChange(false)
        return
      }

      onConfirm(
        slArg !== undefined ? slArg : ((trade.stopLoss ?? undefined) as number | null),
        tpArg !== undefined ? tpArg : ((trade.takeProfit ?? undefined) as number | null),
      )
      return
    }

    // AI suggestion flow — send the confirmed values directly
    onConfirm(
      removeSl ? null : (sl ?? trade.stopLoss ?? null),
      removeTp ? null : (tp ?? trade.takeProfit ?? null),
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modify SL / TP</DialogTitle>
          <DialogDescription>
            <span className="inline-flex items-center gap-2">
              {pair} <DirectionBadge direction={trade.direction} />
              <span>@ {trade.entryPrice}</span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stop Loss */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sl-price" className="text-sm">
                Stop Loss
              </Label>
              <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={removeSl}
                  onChange={(e) => setRemoveSl(e.target.checked)}
                  className="rounded"
                />
                Remove
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="sl-price"
                type="number"
                step="any"
                value={removeSl ? "" : slValue}
                onChange={(e) => setSlValue(e.target.value)}
                disabled={removeSl}
                placeholder={trade.stopLoss?.toString() ?? "No SL set"}
              />
              {slPips !== null && (
                <span className="text-muted-foreground whitespace-nowrap text-xs">
                  {formatPips(slPips)}
                </span>
              )}
            </div>
          </div>

          {/* Take Profit */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tp-price" className="text-sm">
                Take Profit
              </Label>
              <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={removeTp}
                  onChange={(e) => setRemoveTp(e.target.checked)}
                  className="rounded"
                />
                Remove
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="tp-price"
                type="number"
                step="any"
                value={removeTp ? "" : tpValue}
                onChange={(e) => setTpValue(e.target.value)}
                disabled={removeTp}
                placeholder={trade.takeProfit?.toString() ?? "No TP set"}
              />
              {tpPips !== null && (
                <span className="text-muted-foreground whitespace-nowrap text-xs">
                  {formatPips(tpPips)}
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
