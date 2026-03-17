"use client"

import type {
  SmartFlowConfigData,
  SmartFlowPreset,
  SmartFlowConfigRuntimeStatus,
  SmartFlowActivityEvent,
} from "@fxflow/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DirectionBadge } from "@/components/positions/direction-badge"
import { Trash2, ShieldCheck, TrendingUp, Target, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { ConfigRuntimeRow } from "./config-runtime-row"

const PRESET_LABELS: Record<SmartFlowPreset, string> = {
  momentum_catch: "Momentum Catch",
  steady_growth: "Steady Growth",
  swing_capture: "Swing Capture",
  trend_rider: "Trend Rider",
  recovery: "Recovery",
  custom: "Custom",
}

interface ConfigCardProps {
  config: SmartFlowConfigData
  runtime: SmartFlowConfigRuntimeStatus | null
  latestActivity: SmartFlowActivityEvent | null
  toggling: boolean
  onToggle: () => void
  onDelete: () => void
}

export function ConfigCard({
  config,
  runtime,
  latestActivity,
  toggling,
  onToggle,
  onDelete,
}: ConfigCardProps) {
  const fmtAtr = (v: number | null) => (v != null ? `${v.toFixed(1)}x ATR` : "--")

  return (
    <Card className={cn("transition-opacity", !config.isActive && "opacity-60")}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <StatusDot runtime={runtime} isActive={config.isActive} />
          <span className="truncate text-sm font-semibold">{config.name}</span>
          <DirectionBadge direction={config.direction} />
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {PRESET_LABELS[config.preset] ?? config.preset}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Target className="size-3" /> SL: {fmtAtr(config.stopLossAtrMultiple)}
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <TrendingUp className="size-3" /> TP: {fmtAtr(config.takeProfitAtrMultiple)}
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="size-3" /> BE: {config.breakevenEnabled ? "On" : "Off"}
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="size-3" /> Trail: {config.trailingEnabled ? "On" : "Off"}
          </span>
        </div>

        {config.isActive && <ConfigRuntimeRow runtime={runtime} latestActivity={latestActivity} />}

        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-muted-foreground text-[10px]">
            Created {new Date(config.createdAt).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={toggling}
              onClick={onToggle}
            >
              {config.isActive ? "Pause" : "Activate"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive h-7 px-2"
              onClick={onDelete}
              aria-label={`Delete ${config.name}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusDot({
  runtime,
  isActive,
}: {
  runtime: SmartFlowConfigRuntimeStatus | null
  isActive: boolean
}) {
  if (!isActive) {
    return (
      <span
        className="bg-muted-foreground/40 inline-block size-2 shrink-0 rounded-full"
        aria-label="Inactive"
      />
    )
  }
  if (runtime?.receiving_ticks) {
    return (
      <span
        className="inline-block size-2 shrink-0 animate-pulse rounded-full bg-green-500"
        aria-label="Receiving ticks"
      />
    )
  }
  if (runtime && !runtime.receiving_ticks) {
    return (
      <span
        className="inline-block size-2 shrink-0 rounded-full bg-amber-500"
        aria-label="Market closed"
      />
    )
  }
  return (
    <span
      className="bg-muted-foreground/40 inline-block size-2 shrink-0 rounded-full"
      aria-label="Loading status"
    />
  )
}
