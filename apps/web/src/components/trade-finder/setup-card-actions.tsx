"use client"

import { useState } from "react"
import type { TradeFinderSetupData } from "@fxflow/types"
import { Button } from "@/components/ui/button"
import { PlaceOrderDialog } from "./place-order-dialog"

interface SetupCardActionsProps {
  setup: TradeFinderSetupData
  onPlace?: (setupId: string, orderType: "MARKET" | "LIMIT") => void
}

export function SetupCardActions({ setup, onPlace }: SetupCardActionsProps) {
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    orderType: "MARKET" | "LIMIT"
  }>({ open: false, orderType: "LIMIT" })
  const [isPlacing, setIsPlacing] = useState(false)

  if (setup.status !== "active" && setup.status !== "approaching") return null
  if (!onPlace) return null

  const handlePlaceClick = (orderType: "MARKET" | "LIMIT") => {
    setConfirmDialog({ open: true, orderType })
  }

  const handleConfirm = async () => {
    setIsPlacing(true)
    try {
      await onPlace(setup.id, confirmDialog.orderType)
      setConfirmDialog({ open: false, orderType: "LIMIT" })
    } finally {
      setIsPlacing(false)
    }
  }

  return (
    <>
      <div className="flex gap-2 px-4 pb-4 pt-1">
        <Button
          variant="default"
          size="sm"
          className="h-8 flex-1 gap-1.5 text-xs"
          onClick={() => handlePlaceClick("LIMIT")}
        >
          Place Limit Order
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => handlePlaceClick("MARKET")}
        >
          Market Order
        </Button>
      </div>

      <PlaceOrderDialog
        setup={setup}
        orderType={confirmDialog.orderType}
        open={confirmDialog.open}
        onOpenChange={(v) => setConfirmDialog((prev) => ({ ...prev, open: v }))}
        onConfirm={handleConfirm}
        isPlacing={isPlacing}
      />
    </>
  )
}
