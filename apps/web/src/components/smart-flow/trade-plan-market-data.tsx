"use client"

import type { SmartFlowConfigRuntimeStatus } from "@fxflow/types"
import { BarChart3, Gauge } from "lucide-react"
import { cn } from "@/lib/utils"

interface TradePlanMarketDataProps {
  runtime: SmartFlowConfigRuntimeStatus | null
}

export function TradePlanMarketData({ runtime }: TradePlanMarketDataProps) {
  if (!runtime) return null

  const hasAtr = runtime.currentAtr != null
  const hasSpread = runtime.currentSpread != null
  const hasTicks = runtime.receiving_ticks

  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
        Live Market Data
      </p>
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        {hasAtr && (
          <span className="flex items-center gap-1">
            <BarChart3 className="text-muted-foreground size-3" aria-hidden="true" />
            <span className="text-muted-foreground">ATR</span>
            <span className="font-mono font-medium">{runtime.currentAtr!.toFixed(0)}p</span>
          </span>
        )}
        {hasSpread && (
          <span className="flex items-center gap-1">
            <Gauge className="text-muted-foreground size-3" aria-hidden="true" />
            <span className="text-muted-foreground">Spread</span>
            <span className="font-mono font-medium">{runtime.currentSpread!.toFixed(1)}p</span>
            <SpreadDot status={runtime.spreadStatus} />
          </span>
        )}
        <span
          className="flex items-center gap-1"
          aria-label={hasTicks ? "Receiving live data" : "No live data"}
        >
          <span
            className={cn(
              "inline-block size-1.5 rounded-full",
              hasTicks ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/40",
            )}
            aria-hidden="true"
          />
          <span className="text-muted-foreground">{hasTicks ? "Live" : "No data"}</span>
        </span>
      </div>
    </div>
  )
}

function SpreadDot({ status }: { status: SmartFlowConfigRuntimeStatus["spreadStatus"] }) {
  const colors: Record<SmartFlowConfigRuntimeStatus["spreadStatus"], string> = {
    normal: "bg-emerald-500",
    elevated: "bg-amber-500",
    blocked: "bg-red-500",
  }
  const labels: Record<SmartFlowConfigRuntimeStatus["spreadStatus"], string> = {
    normal: "OK",
    elevated: "High",
    blocked: "Blocked",
  }
  return (
    <span
      className={cn("inline-block size-1.5 rounded-full", colors[status])}
      title={labels[status]}
      aria-label={`Spread status: ${labels[status]}`}
    />
  )
}
