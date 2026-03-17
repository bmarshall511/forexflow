"use client"

import { cn } from "@/lib/utils"
import { Grid3X3, TrendingUp, BarChart2 } from "lucide-react"

export interface OverlayVisibility {
  showZones: boolean
  showTrend: boolean
  showCurve: boolean
}

interface ChartOverlayTogglesProps {
  visibility: OverlayVisibility
  onChange: (next: OverlayVisibility) => void
  /** Hide toggles for data that doesn't exist */
  hasTrend?: boolean
  hasCurve?: boolean
  className?: string
}

const TOGGLE_BASE =
  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors select-none"
const TOGGLE_ON = "bg-primary/10 text-primary"
const TOGGLE_OFF = "text-muted-foreground hover:text-foreground hover:bg-muted"

export function ChartOverlayToggles({
  visibility,
  onChange,
  hasTrend = true,
  hasCurve = true,
  className,
}: ChartOverlayTogglesProps) {
  const toggle = (key: keyof OverlayVisibility) =>
    onChange({ ...visibility, [key]: !visibility[key] })

  return (
    <div
      className={cn("flex items-center gap-1 px-1", className)}
      role="group"
      aria-label="Chart overlay toggles"
    >
      <button
        type="button"
        aria-pressed={visibility.showZones}
        onClick={() => toggle("showZones")}
        className={cn(TOGGLE_BASE, visibility.showZones ? TOGGLE_ON : TOGGLE_OFF)}
      >
        <Grid3X3 className="size-2.5" />
        Zones
      </button>
      {hasTrend && (
        <button
          type="button"
          aria-pressed={visibility.showTrend}
          onClick={() => toggle("showTrend")}
          className={cn(TOGGLE_BASE, visibility.showTrend ? TOGGLE_ON : TOGGLE_OFF)}
        >
          <TrendingUp className="size-2.5" />
          Trend
        </button>
      )}
      {hasCurve && (
        <button
          type="button"
          aria-pressed={visibility.showCurve}
          onClick={() => toggle("showCurve")}
          className={cn(TOGGLE_BASE, visibility.showCurve ? TOGGLE_ON : TOGGLE_OFF)}
        >
          <BarChart2 className="size-2.5" />
          Curve
        </button>
      )}
    </div>
  )
}
