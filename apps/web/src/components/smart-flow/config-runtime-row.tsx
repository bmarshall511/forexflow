"use client"

import type { SmartFlowConfigRuntimeStatus, SmartFlowActivityEvent } from "@fxflow/types"
import { formatRelativeTime } from "@fxflow/shared"
import { Badge } from "@/components/ui/badge"
import { Activity, Gauge, BarChart3, Radio } from "lucide-react"
import { cn } from "@/lib/utils"

const SPREAD_BADGE: Record<
  SmartFlowConfigRuntimeStatus["spreadStatus"],
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  normal: { label: "Normal", variant: "default" },
  elevated: { label: "Elevated", variant: "secondary" },
  blocked: { label: "Blocked", variant: "destructive" },
}

interface ConfigRuntimeRowProps {
  runtime: SmartFlowConfigRuntimeStatus | null
  latestActivity: SmartFlowActivityEvent | null
}

export function ConfigRuntimeRow({ runtime, latestActivity }: ConfigRuntimeRowProps) {
  if (!runtime) return null

  const spreadBadge = SPREAD_BADGE[runtime.spreadStatus]

  return (
    <div className="space-y-1.5 border-t pt-2">
      {/* Live metrics row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {runtime.currentAtr != null && (
          <span className="text-muted-foreground flex items-center gap-1">
            <BarChart3 className="size-3" />
            ATR: {runtime.currentAtr.toFixed(0)}p
          </span>
        )}
        {runtime.currentSpread != null && (
          <span className="text-muted-foreground flex items-center gap-1">
            <Gauge className="size-3" />
            Spread: {runtime.currentSpread.toFixed(1)}p
            <Badge variant={spreadBadge.variant} className="ml-0.5 px-1 py-0 text-[9px]">
              {spreadBadge.label}
            </Badge>
          </span>
        )}
        <span className="flex items-center gap-1">
          <TickIndicator active={runtime.receiving_ticks} />
        </span>
      </div>

      {/* Phase + last activity row */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        {runtime.managementPhase && (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            <Activity className="mr-0.5 size-2.5" />
            {formatPhase(runtime.managementPhase)}
          </Badge>
        )}
        <span className="text-muted-foreground flex items-center gap-1 truncate">
          <Radio className="size-3 shrink-0" />
          {latestActivity
            ? `Last: ${latestActivity.message} — ${formatRelativeTime(latestActivity.timestamp)}`
            : "No activity yet"}
        </span>
      </div>
    </div>
  )
}

function TickIndicator({ active }: { active: boolean }) {
  return (
    <span className="flex items-center gap-1 text-[11px]">
      <span
        className={cn(
          "inline-block size-1.5 rounded-full",
          active ? "animate-pulse bg-green-500" : "bg-muted-foreground/40",
        )}
        aria-label={active ? "Receiving ticks" : "No ticks"}
      />
      <span className="text-muted-foreground">Ticks</span>
    </span>
  )
}

function formatPhase(phase: string): string {
  return phase.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
