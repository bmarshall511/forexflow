"use client"

import { useState } from "react"
import type { PendingOrderData } from "@fxflow/types"
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
import { Label } from "@/components/ui/label"
import { DirectionBadge } from "./direction-badge"

interface CancelOrderDialogProps {
  order: PendingOrderData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason?: string) => void
  isLoading: boolean
}

export function CancelOrderDialog({
  order,
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: CancelOrderDialogProps) {
  const [reason, setReason] = useState("")

  if (!order) return null

  const pair = order.instrument.replace("_", "/")

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setReason("")
    onOpenChange(nextOpen)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Order</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel this pending order?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-md bg-muted/50 p-3 space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">{pair}</span>
            <DirectionBadge direction={order.direction} />
            <span className="text-muted-foreground capitalize">{order.orderType.replace("_", " ")}</span>
          </div>
          <div className="text-muted-foreground">
            {order.units} units @ {order.entryPrice}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cancel-reason" className="text-sm">
            Reason <span className="text-muted-foreground">(optional)</span>
          </Label>
          <textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you cancelling this order?"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[60px] resize-none"
            rows={2}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Keep Order</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(e) => {
              e.preventDefault()
              onConfirm(reason.trim() || undefined)
            }}
            disabled={isLoading}
          >
            {isLoading ? "Cancelling..." : "Cancel Order"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
