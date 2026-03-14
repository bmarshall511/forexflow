"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Shield, Layers, Loader2, ChevronDown, ChevronUp } from "lucide-react"

interface ConditionPresetsProps {
  trade: {
    id: string
    status: string
    direction: string
    entryPrice: number
    instrument: string
    currentUnits: number
  }
  onCreated: () => void
}

// ─── Break-Even + Trail Preset ─────────────────────────────────────────────────

function BreakEvenTrailForm({ trade, onCreated }: ConditionPresetsProps) {
  const [breakevenPips, setBreakevenPips] = useState("10")
  const [trailDistancePips, setTrailDistancePips] = useState("15")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isValid =
    !!breakevenPips &&
    !isNaN(parseFloat(breakevenPips)) &&
    parseFloat(breakevenPips) > 0 &&
    !!trailDistancePips &&
    !isNaN(parseFloat(trailDistancePips)) &&
    parseFloat(trailDistancePips) > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setIsSubmitting(true)

    try {
      const bePips = parseFloat(breakevenPips)
      const trailPips = parseFloat(trailDistancePips)

      // Step 1: Create break-even condition (active)
      const beRes = await fetch(`/api/ai/conditions/${trade.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerType: "pnl_pips",
          triggerValue: { pips: bePips, direction: "profit" },
          actionType: "move_stop_loss",
          actionParams: { price: trade.entryPrice },
          label: `Break-even at +${bePips} pips`,
        }),
      })
      const beJson = (await beRes.json()) as { ok: boolean; data?: { id: string }; error?: string }
      if (!beJson.ok || !beJson.data)
        throw new Error(beJson.error ?? "Failed to create break-even condition")

      // Step 2: Create trailing stop condition (waiting, chained to break-even)
      const trailRes = await fetch(`/api/ai/conditions/${trade.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerType: "trailing_stop",
          triggerValue: { distance_pips: trailPips },
          actionType: "move_stop_loss",
          actionParams: {},
          label: `Trail ${trailPips} pips`,
          parentConditionId: beJson.data.id,
          status: "waiting",
        }),
      })
      const trailJson = (await trailRes.json()) as { ok: boolean; error?: string }
      if (!trailJson.ok)
        throw new Error(trailJson.error ?? "Failed to create trailing stop condition")

      toast.success("Break-even + trail conditions created")
      onCreated()
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Profit trigger (pips)</Label>
        <Input
          type="number"
          step="0.1"
          min="0.1"
          className="h-8 text-xs"
          placeholder="e.g. 10"
          value={breakevenPips}
          onChange={(e) => setBreakevenPips(e.target.value)}
        />
        <p className="text-muted-foreground text-[10px]">
          How many pips in profit before moving SL to entry
        </p>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Trail distance (pips)</Label>
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
          How far behind price to trail after break-even
        </p>
      </div>
      <Button
        size="sm"
        className="h-7 w-full text-xs"
        onClick={() => void handleSubmit()}
        disabled={!isValid || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-1 size-3 animate-spin" />
            Creating...
          </>
        ) : (
          "Create Conditions"
        )}
      </Button>
    </div>
  )
}

// ─── Scale-Out Ladder Preset ───────────────────────────────────────────────────

interface ScaleLevel {
  price: string
  percentage: string
}

function ScaleOutLadderForm({ trade, onCreated }: ConditionPresetsProps) {
  const [levels, setLevels] = useState<ScaleLevel[]>([
    { price: "", percentage: "33" },
    { price: "", percentage: "33" },
    { price: "", percentage: "34" },
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateLevel = (index: number, field: keyof ScaleLevel, value: string) => {
    setLevels((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)))
  }

  const addLevel = () => {
    if (levels.length >= 5) return
    setLevels((prev) => [...prev, { price: "", percentage: "" }])
  }

  const removeLevel = (index: number) => {
    if (levels.length <= 2) return
    setLevels((prev) => prev.filter((_, i) => i !== index))
  }

  const totalPercentage = levels.reduce((sum, l) => sum + (parseFloat(l.percentage) || 0), 0)

  const isValid =
    levels.every(
      (l) =>
        !!l.price &&
        !isNaN(parseFloat(l.price)) &&
        !!l.percentage &&
        !isNaN(parseFloat(l.percentage)) &&
        parseFloat(l.percentage) > 0,
    ) && Math.abs(totalPercentage - 100) < 0.01

  const handleSubmit = async () => {
    if (!isValid) return
    setIsSubmitting(true)

    try {
      for (let i = 0; i < levels.length; i++) {
        const level = levels[i]!
        const pct = parseFloat(level.percentage)
        const price = parseFloat(level.price)
        const units = Math.round((pct / 100) * trade.currentUnits)

        const res = await fetch(`/api/ai/conditions/${trade.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            triggerType: trade.direction === "long" ? "price_breaks_above" : "price_breaks_below",
            triggerValue: { price },
            actionType: "partial_close",
            actionParams: { units },
            label: `TP${i + 1}: Close ${pct}% at ${price}`,
          }),
        })
        const json = (await res.json()) as { ok: boolean; error?: string }
        if (!json.ok) throw new Error(json.error ?? `Failed to create level ${i + 1}`)
      }

      toast.success(`Scale-out ladder created (${levels.length} levels)`)
      onCreated()
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {levels.map((level, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-muted-foreground w-6 shrink-0 text-[10px]">TP{i + 1}</span>
            <Input
              type="number"
              step="any"
              className="h-7 flex-1 text-xs"
              placeholder="Price"
              value={level.price}
              onChange={(e) => updateLevel(i, "price", e.target.value)}
            />
            <div className="relative w-20 shrink-0">
              <Input
                type="number"
                step="1"
                min="1"
                max="100"
                className="h-7 pr-5 text-xs"
                placeholder="%"
                value={level.percentage}
                onChange={(e) => updateLevel(i, "percentage", e.target.value)}
              />
              <span className="text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 text-[10px]">
                %
              </span>
            </div>
            {levels.length > 2 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 p-0"
                onClick={() => removeLevel(i)}
              >
                <span className="text-muted-foreground text-xs">&times;</span>
                <span className="sr-only">Remove level</span>
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        {levels.length < 5 && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={addLevel}>
            + Add level
          </Button>
        )}
        <p
          className={cn(
            "ml-auto text-[10px]",
            Math.abs(totalPercentage - 100) < 0.01 ? "text-emerald-600" : "text-amber-600",
          )}
        >
          Total: {totalPercentage.toFixed(0)}%
          {Math.abs(totalPercentage - 100) >= 0.01 && " (must be 100%)"}
        </p>
      </div>

      <p className="text-muted-foreground text-[10px]">
        Direction: {trade.direction === "long" ? "Price breaks above" : "Price breaks below"} each
        level. Units auto-calculated from {trade.currentUnits.toLocaleString()} total.
      </p>

      <Button
        size="sm"
        className="h-7 w-full text-xs"
        onClick={() => void handleSubmit()}
        disabled={!isValid || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-1 size-3 animate-spin" />
            Creating...
          </>
        ) : (
          `Create ${levels.length} Take-Profit Levels`
        )}
      </Button>
    </div>
  )
}

// ─── Presets Container ─────────────────────────────────────────────────────────

export function ConditionPresets({ trade, onCreated }: ConditionPresetsProps) {
  const [expanded, setExpanded] = useState<"be-trail" | "scale-out" | null>(null)

  return (
    <div className="bg-muted/20 space-y-2 rounded-lg border p-3">
      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        Quick Presets
      </p>

      {/* Break-Even + Trail */}
      <div className="bg-background rounded-md border">
        <button
          type="button"
          className="flex w-full items-center justify-between p-2.5 text-left"
          onClick={() => setExpanded(expanded === "be-trail" ? null : "be-trail")}
        >
          <div className="flex items-center gap-2">
            <Shield className="size-3.5 text-blue-500" />
            <div>
              <p className="text-xs font-medium">Break-even + Trail</p>
              <p className="text-muted-foreground text-[10px]">
                Move SL to entry, then trail behind price
              </p>
            </div>
          </div>
          {expanded === "be-trail" ? (
            <ChevronUp className="text-muted-foreground size-3.5" />
          ) : (
            <ChevronDown className="text-muted-foreground size-3.5" />
          )}
        </button>
        {expanded === "be-trail" && (
          <div className="px-2.5 pb-2.5 pt-0">
            <BreakEvenTrailForm trade={trade} onCreated={onCreated} />
          </div>
        )}
      </div>

      {/* Scale-Out Ladder */}
      <div className="bg-background rounded-md border">
        <button
          type="button"
          className="flex w-full items-center justify-between p-2.5 text-left"
          onClick={() => setExpanded(expanded === "scale-out" ? null : "scale-out")}
        >
          <div className="flex items-center gap-2">
            <Layers className="size-3.5 text-purple-500" />
            <div>
              <p className="text-xs font-medium">Scale-Out Ladder</p>
              <p className="text-muted-foreground text-[10px]">
                Partial close at multiple take-profit levels
              </p>
            </div>
          </div>
          {expanded === "scale-out" ? (
            <ChevronUp className="text-muted-foreground size-3.5" />
          ) : (
            <ChevronDown className="text-muted-foreground size-3.5" />
          )}
        </button>
        {expanded === "scale-out" && (
          <div className="px-2.5 pb-2.5 pt-0">
            <ScaleOutLadderForm trade={trade} onCreated={onCreated} />
          </div>
        )}
      </div>
    </div>
  )
}
