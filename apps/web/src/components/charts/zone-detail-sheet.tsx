"use client"

import type { ZoneData } from "@fxflow/types"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ZoneDetailSheetProps {
  zone: ZoneData | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATUS_CONFIG: Record<ZoneData["status"], { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-500/10", text: "text-emerald-500", label: "Active" },
  tested: { bg: "bg-amber-500/10", text: "text-amber-500", label: "Tested" },
  invalidated: { bg: "bg-red-500/10", text: "text-red-500", label: "Invalidated" },
}

const FORMATION_DESCRIPTIONS: Record<string, string> = {
  DBR: "Drop-Base-Rally: Price dropped, paused in a base, then rallied away. This creates a demand zone where buyers overwhelmed sellers.",
  RBR: "Rally-Base-Rally: Price rallied, paused in a base, then continued rallying. This creates a demand zone — unfilled buy orders remain at the base.",
  RBD: "Rally-Base-Drop: Price rallied, paused in a base, then dropped away. This creates a supply zone where sellers overwhelmed buyers.",
  DBD: "Drop-Base-Drop: Price dropped, paused in a base, then continued dropping. This creates a supply zone — unfilled sell orders remain at the base.",
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

export function ZoneDetailSheet({ zone, open, onOpenChange }: ZoneDetailSheetProps) {
  if (!zone) return null

  const status = STATUS_CONFIG[zone.status]
  const scores = zone.scores
  const isDemand = zone.type === "demand"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-3 w-3 rounded-full shrink-0",
                isDemand ? "bg-emerald-500" : "bg-red-500",
              )}
            />
            <SheetTitle className="text-base">
              {zone.type === "demand" ? "Demand" : "Supply"} Zone
            </SheetTitle>
            <Badge variant="outline" className={cn("text-[10px] ml-auto", status.bg, status.text)}>
              {status.label}
            </Badge>
          </div>
          <SheetDescription className="sr-only">
            Zone details for {zone.formation} at {zone.proximalLine}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 space-y-5 pb-6">
          {/* Total score hero */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div>
              <span className="text-xs text-muted-foreground">Total Score</span>
              <div className={cn("text-3xl font-bold tabular-nums", getTotalColor(scores.total))}>
                {scores.total.toFixed(1)}
                <span className="text-sm font-normal text-muted-foreground">/5</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium">{zone.formation}</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">{zone.timeframe}</p>
            </div>
          </div>

          {/* Formation explanation */}
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Formation</h3>
            <p className="text-xs leading-relaxed text-foreground/80">
              {FORMATION_DESCRIPTIONS[zone.formation] ?? zone.formation}
            </p>
          </div>

          {/* Score breakdown */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score Breakdown</h3>
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

          {/* Price levels */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price Levels</h3>
            <div className="grid grid-cols-2 gap-2">
              <PriceCard
                label="Proximal (Entry)"
                value={zone.proximalLine}
                decimals={zone.proximalLine < 10 ? 5 : 3}
                color={isDemand ? "text-emerald-500" : "text-red-500"}
              />
              <PriceCard
                label="Distal (Stop)"
                value={zone.distalLine}
                decimals={zone.distalLine < 10 ? 5 : 3}
                color="text-muted-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <DetailCard label="Width" value={`${zone.widthPips.toFixed(1)} pips`} />
              <DetailCard label="Distance" value={`${zone.distanceFromPricePips.toFixed(1)} pips`} />
            </div>
          </div>

          {/* Zone metadata */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</h3>
            <div className="grid grid-cols-2 gap-2">
              <DetailCard label="Base Candles" value={zone.baseCandles.toString()} />
              <DetailCard label="Age" value={`${zone.ageInCandles} candles`} />
              <DetailCard label="Tests" value={zone.testCount.toString()} />
              <DetailCard
                label="Penetration"
                value={zone.penetrationPercent > 0 ? `${zone.penetrationPercent.toFixed(0)}%` : "None"}
              />
            </div>
          </div>

          {/* What this means */}
          <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-dashed">
            <h3 className="text-xs font-semibold">What does this mean?</h3>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {isDemand ? (
                <>
                  This is a <strong className="text-emerald-500">demand zone</strong> — a price level where
                  buyers previously stepped in with enough force to push price higher. If price returns to
                  this level, there may be unfilled buy orders waiting, potentially causing price to bounce up again.
                  {zone.scores.total >= 3.5 && " This is a high-quality zone with strong institutional interest."}
                  {zone.testCount === 0 && " This zone has never been tested, making it more likely to hold."}
                  {zone.testCount > 0 && ` This zone has been tested ${zone.testCount} time${zone.testCount > 1 ? "s" : ""}, which may weaken it.`}
                </>
              ) : (
                <>
                  This is a <strong className="text-red-500">supply zone</strong> — a price level where
                  sellers previously stepped in with enough force to push price lower. If price returns to
                  this level, there may be unfilled sell orders waiting, potentially causing price to drop again.
                  {zone.scores.total >= 3.5 && " This is a high-quality zone with strong institutional interest."}
                  {zone.testCount === 0 && " This zone has never been tested, making it more likely to hold."}
                  {zone.testCount > 0 && ` This zone has been tested ${zone.testCount} time${zone.testCount > 1 ? "s" : ""}, which may weaken it.`}
                </>
              )}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-xs tabular-nums font-mono font-semibold">
          {value.toFixed(1)}/{max}
        </span>
      </div>
      <Progress
        value={value}
        max={max}
        indicatorClassName={getScoreColor(value, max)}
        className="h-2"
      />
      <p className="text-[11px] text-muted-foreground leading-snug">{explanation}</p>
    </div>
  )
}

function PriceCard({
  label,
  value,
  decimals,
  color,
}: {
  label: string
  value: number
  decimals: number
  color: string
}) {
  return (
    <div className="p-2 rounded-md bg-muted/50 border">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <div className={cn("text-sm font-mono tabular-nums font-semibold", color)}>
        {value.toFixed(decimals)}
      </div>
    </div>
  )
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-md bg-muted/50 border">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <div className="text-sm font-mono tabular-nums">{value}</div>
    </div>
  )
}
