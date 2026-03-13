"use client"

import type { ZoneData, CurveAlignment, CurvePosition } from "@fxflow/types"
import { cn } from "@/lib/utils"

interface ZoneSummaryBarProps {
  nearestDemand: ZoneData | null
  nearestSupply: ZoneData | null
  curveAlignment: CurveAlignment
  curvePosition: CurvePosition | null
  currentPrice: number | null
  isComputing: boolean
  /** Called when a zone pill is clicked — opens the detail sheet */
  onZoneClick?: (zone: ZoneData) => void
  className?: string
}

const CURVE_POSITION_STYLES: Record<CurvePosition, { label: string; color: string; arrow: string } | null> = {
  high: { label: "High on Curve", color: "text-red-500", arrow: "\u2193" },
  middle: { label: "Mid on Curve", color: "text-muted-foreground", arrow: "\u2194" },
  low: { label: "Low on Curve", color: "text-emerald-500", arrow: "\u2191" },
  above: { label: "Above Curve", color: "text-red-500", arrow: "\u21c8" },
  below: { label: "Below Curve", color: "text-emerald-500", arrow: "\u21ca" },
  none: null,
}

const ALIGNMENT_STYLES: Record<CurveAlignment, { label: string; color: string; icon: string }> = {
  aligned: { label: "Aligned", color: "text-emerald-500", icon: "check-circle" },
  conflicting: { label: "Conflicting", color: "text-red-500", icon: "x-circle" },
  neutral: { label: "Neutral", color: "text-muted-foreground", icon: "minus-circle" },
}

export function ZoneSummaryBar({
  nearestDemand,
  nearestSupply,
  curveAlignment,
  curvePosition,
  currentPrice,
  isComputing,
  onZoneClick,
  className,
}: ZoneSummaryBarProps) {
  if (!nearestDemand && !nearestSupply) return null

  const alignment = ALIGNMENT_STYLES[curveAlignment]

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-2.5 py-1 text-[11px] bg-muted/50 rounded-md border",
        className,
      )}
      role="status"
      aria-label="Zone summary"
    >
      {/* Nearest Demand */}
      {nearestDemand && (
        <ZonePill
          type="demand"
          zone={nearestDemand}
          currentPrice={currentPrice}
          onClick={onZoneClick}
        />
      )}

      {/* Separator */}
      {nearestDemand && nearestSupply && (
        <div className="h-3 w-px bg-border shrink-0" />
      )}

      {/* Nearest Supply */}
      {nearestSupply && (
        <ZonePill
          type="supply"
          zone={nearestSupply}
          currentPrice={currentPrice}
          onClick={onZoneClick}
        />
      )}

      {/* Curve alignment */}
      {curveAlignment !== "neutral" && (
        <>
          <div className="h-3 w-px bg-border shrink-0" />
          <span className={cn("flex items-center gap-1 shrink-0", alignment.color)}>
            {curveAlignment === "aligned" ? (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="font-medium">{alignment.label}</span>
          </span>
        </>
      )}

      {/* Curve position */}
      {curvePosition && curvePosition !== "none" && CURVE_POSITION_STYLES[curvePosition] && (
        <>
          <div className="h-3 w-px bg-border shrink-0" />
          <span className={cn("flex items-center gap-1 shrink-0", CURVE_POSITION_STYLES[curvePosition]!.color)}>
            <span className="font-medium">{CURVE_POSITION_STYLES[curvePosition]!.arrow}</span>
            <span className="font-medium">{CURVE_POSITION_STYLES[curvePosition]!.label}</span>
          </span>
        </>
      )}

      {/* Computing indicator */}
      {isComputing && (
        <>
          <div className="flex-1" />
          <span className="text-muted-foreground animate-pulse shrink-0">Scanning...</span>
        </>
      )}
    </div>
  )
}

function ZonePill({
  type,
  zone,
  currentPrice,
  onClick,
}: {
  type: "demand" | "supply"
  zone: ZoneData
  currentPrice: number | null
  onClick?: (zone: ZoneData) => void
}) {
  const isDemand = type === "demand"
  const distance = zone.distanceFromPricePips

  return (
    <button
      type="button"
      className="flex items-center gap-1.5 min-w-0 rounded px-1 -mx-1 hover:bg-muted transition-colors cursor-pointer"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(zone)
      }}
      aria-label={`${isDemand ? "Demand" : "Supply"} zone at ${zone.proximalLine.toFixed(zone.proximalLine < 10 ? 5 : 3)}`}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          isDemand ? "bg-emerald-500" : "bg-red-500",
        )}
      />
      <span className="font-medium truncate">
        {isDemand ? "DZ" : "SZ"}{" "}
        <span className="tabular-nums">{zone.proximalLine.toFixed(zone.proximalLine < 10 ? 5 : 3)}</span>
      </span>
      <span className="text-muted-foreground tabular-nums shrink-0">
        {distance.toFixed(1)}p
      </span>
      <span
        className={cn(
          "tabular-nums font-medium shrink-0",
          zone.scores.total >= 3.5 ? "text-emerald-500" :
          zone.scores.total >= 2.0 ? "text-amber-500" : "text-red-500",
        )}
      >
        {zone.scores.total.toFixed(1)}
      </span>
    </button>
  )
}
