"use client"

import { useState } from "react"
import type { OpenTradeData } from "@fxflow/types"
import { formatCurrency } from "@fxflow/shared"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DirectionBadge } from "./direction-badge"

interface CloseTradeDialogProps {
  trade: OpenTradeData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (units?: number, reason?: string) => void
  isLoading: boolean
  currency?: string
}

export function CloseTradeDialog({
  trade,
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  currency = "USD",
}: CloseTradeDialogProps) {
  const [mode, setMode] = useState<"full" | "partial">("full")
  const [partialUnits, setPartialUnits] = useState("")
  const [reason, setReason] = useState("")

  if (!trade) return null

  const pair = trade.instrument.replace("_", "/")
  const plColor = trade.unrealizedPL >= 0 ? "text-emerald-500" : "text-red-500"

  const handleConfirm = () => {
    const trimmedReason = reason.trim() || undefined
    if (mode === "partial") {
      const units = parseInt(partialUnits, 10)
      if (isNaN(units) || units <= 0 || units >= trade.currentUnits) {
        onConfirm(undefined, trimmedReason) // full close if invalid
      } else {
        onConfirm(units, trimmedReason)
      }
    } else {
      onConfirm(undefined, trimmedReason)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMode("full")
      setPartialUnits("")
      setReason("")
    }
    onOpenChange(nextOpen)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close Trade</AlertDialogTitle>
          <AlertDialogDescription>
            This action will close your position on OANDA.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="bg-muted/50 space-y-1 rounded-md p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">{pair}</span>
            <DirectionBadge direction={trade.direction} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{trade.currentUnits} units</span>
            <span className={plColor}>{formatCurrency(trade.unrealizedPL, currency)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("full")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              mode === "full"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            Full Close
          </button>
          <button
            type="button"
            onClick={() => setMode("partial")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              mode === "partial"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            Partial Close
          </button>
        </div>

        {mode === "partial" && (
          <div className="space-y-2">
            <Label htmlFor="partial-units" className="text-sm">
              Units to close (max {trade.currentUnits})
            </Label>
            <Input
              id="partial-units"
              type="number"
              min={1}
              max={trade.currentUnits - 1}
              value={partialUnits}
              onChange={(e) => setPartialUnits(e.target.value)}
              placeholder={`1 – ${trade.currentUnits - 1}`}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="close-reason" className="text-sm">
            Reason <span className="text-muted-foreground">(optional)</span>
          </Label>
          <textarea
            id="close-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you closing this trade?"
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[60px] w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            rows={2}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={isLoading}
          >
            {isLoading ? "Closing..." : mode === "partial" ? "Close Partial" : "Close Trade"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
