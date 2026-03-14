"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
import { X, XCircle, Ban } from "lucide-react"

interface BulkActionBarProps {
  count: number
  type: "open" | "pending" | "closed"
  onClose?: () => Promise<void>
  onCancel?: () => Promise<void>
  onClear: () => void
  isLoading?: boolean
}

export function BulkActionBar({
  count,
  type,
  onClose,
  onCancel,
  onClear,
  isLoading = false,
}: BulkActionBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (count === 0) return null

  const destructiveAction = type === "open" ? onClose : type === "pending" ? onCancel : undefined
  const destructiveLabel = type === "open" ? "Close Selected" : "Cancel Selected"
  const confirmTitle =
    type === "open"
      ? `Close ${count} ${count === 1 ? "trade" : "trades"}?`
      : `Cancel ${count} ${count === 1 ? "order" : "orders"}?`
  const confirmDescription =
    type === "open"
      ? `This will close ${count} open ${count === 1 ? "trade" : "trades"} at the current market price. This action cannot be undone.`
      : `This will cancel ${count} pending ${count === 1 ? "order" : "orders"}. This action cannot be undone.`

  const handleDestructive = async () => {
    await destructiveAction?.()
    setConfirmOpen(false)
  }

  return (
    <>
      <div
        className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-50 border-t px-4 py-3 shadow-lg backdrop-blur-sm"
        role="toolbar"
        aria-label={`Bulk actions for ${count} selected ${count === 1 ? "item" : "items"}`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {count} {count === 1 ? "item" : "items"} selected
          </span>
          <div className="flex items-center gap-2">
            {destructiveAction && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={isLoading}
              >
                {type === "open" ? <XCircle className="mr-1.5 size-3.5" /> : null}
                {type === "pending" ? <Ban className="mr-1.5 size-3.5" /> : null}
                {isLoading ? "Processing..." : destructiveLabel}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClear} disabled={isLoading}>
              <X className="mr-1.5 size-3.5" />
              Deselect All
            </Button>
          </div>
        </div>
      </div>

      {destructiveAction && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDestructive}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {destructiveLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
