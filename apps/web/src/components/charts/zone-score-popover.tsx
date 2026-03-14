"use client"

import type { ZoneData } from "@fxflow/types"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ZoneScorePopoverProps {
  zone: ZoneData
  children: React.ReactNode
}

const STATUS_STYLES: Record<ZoneData["status"], { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-500/10", text: "text-emerald-500", label: "Active" },
  tested: { bg: "bg-amber-500/10", text: "text-amber-500", label: "Tested" },
  invalidated: { bg: "bg-red-500/10", text: "text-red-500", label: "Invalidated" },
}

const FORMATION_LABELS: Record<string, string> = {
  DBR: "Drop-Base-Rally",
  RBR: "Rally-Base-Rally",
  RBD: "Rally-Base-Drop",
  DBD: "Drop-Base-Drop",
}

function getScoreColor(value: number, max: number): string {
  const pct = value / max
  if (pct >= 0.8) return "bg-emerald-500"
  if (pct >= 0.5) return "bg-amber-500"
  return "bg-red-500"
}

function getTotalColor(total: number): string {
  if (total >= 4.0) return "text-emerald-500"
  if (total >= 2.5) return "text-amber-500"
  return "text-red-500"
}

export function ZoneScorePopover({ zone, children }: ZoneScorePopoverProps) {
  const status = STATUS_STYLES[zone.status]
  const scores = zone.scores

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                zone.type === "demand" ? "bg-emerald-500" : "bg-red-500",
              )}
            />
            <span className="text-sm font-semibold capitalize">{zone.type} Zone</span>
          </div>
          <Badge variant="outline" className={cn("text-[10px]", status.bg, status.text)}>
            {status.label}
          </Badge>
        </div>

        {/* Formation & total score */}
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div>
            <span className="text-xs font-medium">{zone.formation}</span>
            <span className="text-muted-foreground ml-1.5 text-[10px]">
              {FORMATION_LABELS[zone.formation]}
            </span>
          </div>
          <span className={cn("text-lg font-bold tabular-nums", getTotalColor(scores.total))}>
            {scores.total.toFixed(1)}
            <span className="text-muted-foreground text-xs font-normal">/5</span>
          </span>
        </div>

        {/* Score breakdown */}
        <div className="space-y-3 px-3 py-2">
          <ScoreRow
            label={scores.strength.label}
            value={scores.strength.value}
            max={scores.strength.max}
            explanation={scores.strength.explanation}
          />
          <ScoreRow
            label={scores.time.label}
            value={scores.time.value}
            max={scores.time.max}
            explanation={scores.time.explanation}
          />
          <ScoreRow
            label={scores.freshness.label}
            value={scores.freshness.value}
            max={scores.freshness.max}
            explanation={scores.freshness.explanation}
          />
        </div>

        {/* Zone details */}
        <div className="space-y-1.5 border-t px-3 py-2">
          <DetailRow label="Proximal (entry)" value={zone.proximalLine.toFixed(5)} />
          <DetailRow label="Distal (stop)" value={zone.distalLine.toFixed(5)} />
          <DetailRow label="Width" value={`${zone.widthPips.toFixed(1)} pips`} />
          <DetailRow label="Base candles" value={zone.baseCandles.toString()} />
          <DetailRow label="Tests" value={zone.testCount.toString()} />
          {zone.penetrationPercent > 0 && (
            <DetailRow label="Penetration" value={`${zone.penetrationPercent.toFixed(0)}%`} />
          )}
          <DetailRow label="Distance" value={`${zone.distanceFromPricePips.toFixed(1)} pips`} />
          <DetailRow label="Age" value={`${zone.ageInCandles} candles`} />
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScoreRow({
  label,
  value,
  max,
  explanation,
}: {
  label: string
  value: number
  max: number
  explanation: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <span className="font-mono text-xs tabular-nums">
          {value.toFixed(1)}/{max}
        </span>
      </div>
      <Progress
        value={value}
        max={max}
        indicatorClassName={getScoreColor(value, max)}
        className="h-1.5"
      />
      <p className="text-muted-foreground text-[10px] leading-tight">{explanation}</p>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-[10px]">{label}</span>
      <span className="font-mono text-xs tabular-nums">{value}</span>
    </div>
  )
}
