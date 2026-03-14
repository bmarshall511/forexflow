"use client"

import { useState } from "react"
import type { PriceAlertData } from "@fxflow/types"
import { FOREX_PAIR_GROUPS } from "@fxflow/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface AlertFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: {
    instrument: string
    direction: "above" | "below"
    targetPrice: number
    currentPrice: number
    label?: string
    repeating?: boolean
    expiresAt?: string
  }) => Promise<void>
  editingAlert?: PriceAlertData | null
  onUpdate?: (
    id: string,
    data: { label?: string; targetPrice?: number; direction?: "above" | "below" },
  ) => Promise<void>
}

export function AlertForm({
  open,
  onOpenChange,
  onSubmit,
  editingAlert,
  onUpdate,
}: AlertFormProps) {
  const [instrument, setInstrument] = useState(editingAlert?.instrument ?? "EUR_USD")
  const [direction, setDirection] = useState<"above" | "below">(editingAlert?.direction ?? "above")
  const [targetPrice, setTargetPrice] = useState(editingAlert?.targetPrice.toString() ?? "")
  const [label, setLabel] = useState(editingAlert?.label ?? "")
  const [repeating, setRepeating] = useState(editingAlert?.repeating ?? false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = !!editingAlert

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const price = parseFloat(targetPrice)
    if (isNaN(price) || price <= 0) return

    setIsSubmitting(true)
    try {
      if (isEditing && onUpdate) {
        await onUpdate(editingAlert.id, {
          label: label || undefined,
          targetPrice: price,
          direction,
        })
      } else {
        await onSubmit({
          instrument,
          direction,
          targetPrice: price,
          currentPrice: price, // Will be overridden by actual price if available
          label: label || undefined,
          repeating,
        })
      }
      onOpenChange(false)
      resetForm()
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setInstrument("EUR_USD")
    setDirection("above")
    setTargetPrice("")
    setLabel("")
    setRepeating(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Alert" : "Create Price Alert"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Update this price alert."
              : "Get notified when price crosses your target level."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-5 px-4 py-2">
          {/* Instrument */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="alert-instrument">Instrument</Label>
            <Select value={instrument} onValueChange={setInstrument} disabled={isEditing}>
              <SelectTrigger id="alert-instrument" className="h-10 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOREX_PAIR_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.pairs.map((pair) => (
                      <SelectItem key={pair.value} value={pair.value}>
                        {pair.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Direction */}
          <div className="flex flex-col gap-2">
            <Label>Direction</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={direction === "above" ? "default" : "outline"}
                className={cn(
                  "flex-1 gap-1.5",
                  direction === "above" && "bg-emerald-600 hover:bg-emerald-700",
                )}
                onClick={() => setDirection("above")}
              >
                <ArrowUp className="size-4" />
                Above
              </Button>
              <Button
                type="button"
                variant={direction === "below" ? "default" : "outline"}
                className={cn(
                  "flex-1 gap-1.5",
                  direction === "below" && "bg-red-600 hover:bg-red-700",
                )}
                onClick={() => setDirection("below")}
              >
                <ArrowDown className="size-4" />
                Below
              </Button>
            </div>
          </div>

          {/* Target Price */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="alert-target-price">Target Price</Label>
            <Input
              id="alert-target-price"
              type="number"
              step="any"
              min="0"
              placeholder="1.08500"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              required
              className="h-10"
            />
          </div>

          {/* Label */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="alert-label">Label (optional)</Label>
            <Input
              id="alert-label"
              type="text"
              placeholder="e.g., Resistance breakout"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-10"
            />
          </div>

          {/* Repeating */}
          {!isEditing && (
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={repeating}
                onChange={(e) => setRepeating(e.target.checked)}
                className="border-input accent-primary size-4 rounded"
              />
              <div>
                <span className="text-sm font-medium">Repeating</span>
                <p className="text-muted-foreground text-xs">Re-arm after each trigger</p>
              </div>
            </label>
          )}

          <SheetFooter className="mt-2">
            <Button type="submit" disabled={isSubmitting || !targetPrice} className="w-full">
              {isSubmitting ? "Saving..." : isEditing ? "Update Alert" : "Create Alert"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
