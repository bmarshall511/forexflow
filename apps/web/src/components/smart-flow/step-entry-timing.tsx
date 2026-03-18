"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, Eye } from "lucide-react"
import { cn } from "@/lib/utils"

interface StepEntryTimingProps {
  pair: string
  direction: "long" | "short"
  entryMode: "market" | "smart_entry"
  entryPrice: string
  entryExpireHours: string
  onEntryModeChange: (mode: "market" | "smart_entry") => void
  onEntryPriceChange: (price: string) => void
  onEntryExpireHoursChange: (hours: string) => void
}

export function StepEntryTiming({
  pair,
  direction,
  entryMode,
  entryPrice,
  entryExpireHours,
  onEntryModeChange,
  onEntryPriceChange,
  onEntryExpireHoursChange,
}: StepEntryTimingProps) {
  const pairLabel = pair.replace("_", "/")
  const dirLabel = direction === "long" ? "buy" : "sell"

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">When should SmartFlow enter?</h3>
        <p className="text-muted-foreground text-sm">
          Choose when to {dirLabel} {pairLabel}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Right Now */}
        <button
          type="button"
          onClick={() => onEntryModeChange("market")}
          className={cn(
            "rounded-lg border p-4 text-left transition-all",
            entryMode === "market"
              ? "border-primary bg-primary/5 ring-primary/20 ring-2"
              : "hover:border-primary/50 hover:bg-muted/50",
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-lg",
                entryMode === "market" ? "bg-primary/10" : "bg-muted",
              )}
            >
              <Zap
                className={cn(
                  "size-4",
                  entryMode === "market" ? "text-primary" : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-sm font-medium">Right Now</p>
              <p className="text-muted-foreground text-xs">
                Place the trade immediately at the current price
              </p>
            </div>
          </div>
        </button>

        {/* Wait for Price */}
        <button
          type="button"
          onClick={() => onEntryModeChange("smart_entry")}
          className={cn(
            "rounded-lg border p-4 text-left transition-all",
            entryMode === "smart_entry"
              ? "border-primary bg-primary/5 ring-primary/20 ring-2"
              : "hover:border-primary/50 hover:bg-muted/50",
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-lg",
                entryMode === "smart_entry" ? "bg-primary/10" : "bg-muted",
              )}
            >
              <Eye
                className={cn(
                  "size-4",
                  entryMode === "smart_entry" ? "text-primary" : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-sm font-medium">Wait for My Price</p>
              <p className="text-muted-foreground text-xs">
                SmartFlow will watch and enter when price reaches your target
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Smart entry fields */}
      {entryMode === "smart_entry" && (
        <Card>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="entryPrice" className="text-xs">
                Enter when price reaches
              </Label>
              <Input
                id="entryPrice"
                type="number"
                step="any"
                placeholder="e.g. 1.0920"
                value={entryPrice}
                onChange={(e) => onEntryPriceChange(e.target.value)}
                className="font-mono"
              />
              <p className="text-muted-foreground text-[11px]">
                SmartFlow will place the trade when {pairLabel} reaches this price
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expireHours" className="text-xs">
                Give up after (hours)
              </Label>
              <Input
                id="expireHours"
                type="number"
                min={1}
                max={168}
                placeholder="48"
                value={entryExpireHours}
                onChange={(e) => onEntryExpireHoursChange(e.target.value)}
              />
              <p className="text-muted-foreground text-[11px]">
                If the price doesn&apos;t reach your target in this time, SmartFlow will cancel the
                plan
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
