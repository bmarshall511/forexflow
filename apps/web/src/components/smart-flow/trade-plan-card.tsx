"use client"

import type {
  SmartFlowConfigData,
  SmartFlowConfigRuntimeStatus,
  SmartFlowActivityEvent,
  SmartFlowTradeData,
} from "@fxflow/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DirectionBadge } from "@/components/positions/direction-badge"
import { formatRelativeTime } from "@fxflow/shared"
import {
  Trash2,
  ShieldCheck,
  TrendingUp,
  Zap,
  Rocket,
  RotateCcw,
  Clock,
  Radio,
  Activity,
  Pause,
  Play,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getTradePlanStatus } from "./trade-plan-status"

const FALLBACK_PRESET = { label: "Custom", icon: Activity, color: "text-gray-500" } as const

const PRESET_META: Record<string, { label: string; icon: typeof Zap; color: string }> = {
  momentum_catch: { label: "Momentum Catch", icon: Zap, color: "text-amber-500" },
  steady_growth: { label: "Steady Growth", icon: ShieldCheck, color: "text-emerald-500" },
  swing_capture: { label: "Swing Capture", icon: TrendingUp, color: "text-blue-500" },
  trend_rider: { label: "Trend Rider", icon: Rocket, color: "text-purple-500" },
  recovery: { label: "Recovery Mode", icon: RotateCcw, color: "text-red-500" },
  custom: { label: "Custom", icon: Activity, color: "text-gray-500" },
}

const STATE_STYLES = {
  trading: {
    border: "border-l-emerald-500",
    dot: "bg-emerald-500 animate-pulse",
    label: "TRADING",
    labelColor: "text-emerald-500",
  },
  watching: {
    border: "border-l-blue-500",
    dot: "bg-blue-500 animate-pulse",
    label: "WATCHING",
    labelColor: "text-blue-500",
  },
  paused: {
    border: "border-l-transparent",
    dot: "bg-muted-foreground/40",
    label: "PAUSED",
    labelColor: "text-muted-foreground",
  },
  pending: {
    border: "border-l-amber-500",
    dot: "bg-amber-500",
    label: "READY",
    labelColor: "text-amber-500",
  },
}

interface TradePlanCardProps {
  config: SmartFlowConfigData
  runtime: SmartFlowConfigRuntimeStatus | null
  latestActivity: SmartFlowActivityEvent | null
  activeTrade?: SmartFlowTradeData
  toggling: boolean
  onToggle: () => void
  onDelete: () => void
}

export function TradePlanCard({
  config,
  runtime,
  latestActivity,
  activeTrade,
  toggling,
  onToggle,
  onDelete,
}: TradePlanCardProps) {
  const presetMeta = PRESET_META[config.preset] ?? FALLBACK_PRESET
  const PresetIcon = presetMeta.icon
  const status = getTradePlanStatus(config, runtime, activeTrade)
  const style = STATE_STYLES[status.state]

  return (
    <Card
      className={cn(
        "overflow-hidden border-l-4 transition-all",
        style.border,
        !config.isActive && "opacity-70",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", style.dot)} aria-hidden="true" />
          <span
            className={cn("text-[11px] font-semibold uppercase tracking-wider", style.labelColor)}
          >
            {style.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{config.instrument.replace("_", "/")}</span>
          <DirectionBadge direction={config.direction} />
        </div>
      </div>

      {/* Strategy label */}
      <div className="flex items-center gap-1.5 px-4 pb-2">
        <PresetIcon className={cn("size-3.5", presetMeta.color)} aria-hidden="true" />
        <span className={cn("text-xs font-medium", presetMeta.color)}>{presetMeta.label}</span>
        <span className="text-muted-foreground text-[11px]">Strategy</span>
      </div>

      {/* Status description */}
      <div className="bg-muted/50 mx-4 rounded-lg px-3 py-2.5">
        <p className="text-foreground text-xs leading-relaxed">{status.description}</p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">{status.strategyDesc}</p>
      </div>

      {/* Protection badges (when active) */}
      {config.isActive && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          <ProtectionBadge
            icon={ShieldCheck}
            label="Break-even"
            active={config.breakevenEnabled}
            triggered={activeTrade?.breakevenTriggered}
          />
          <ProtectionBadge
            icon={TrendingUp}
            label="Trailing"
            active={config.trailingEnabled}
            triggered={activeTrade?.trailingActivated}
          />
          {config.newsProtectionEnabled && <ProtectionBadge icon={Radio} label="News" active />}
          {config.recoveryEnabled && <ProtectionBadge icon={RotateCcw} label="Recovery" active />}
          {config.maxHoldHours != null && (
            <ProtectionBadge icon={Clock} label={formatHoldTime(config.maxHoldHours)} active />
          )}
        </div>
      )}

      {/* Latest activity */}
      {latestActivity && (
        <div className="mx-4 mt-2.5 flex items-center gap-1.5 text-[11px]">
          <span
            className={cn(
              "inline-block size-1.5 shrink-0 rounded-full",
              severityColor(latestActivity.severity),
            )}
            aria-hidden="true"
          />
          <span className="text-muted-foreground truncate">{latestActivity.message}</span>
          <span className="text-muted-foreground/60 shrink-0">
            {formatRelativeTime(latestActivity.timestamp)}
          </span>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between px-4 pb-3 pt-3">
        <span className="text-muted-foreground text-[10px]">
          Created {new Date(config.createdAt).toLocaleDateString()}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[11px]"
            disabled={toggling}
            onClick={onToggle}
          >
            {config.isActive ? (
              <>
                <Pause className="size-3" aria-hidden="true" /> Pause
              </>
            ) : (
              <>
                <Play className="size-3" aria-hidden="true" /> Activate
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive h-7 w-7 p-0"
            onClick={onDelete}
            aria-label={`Delete ${config.name}`}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProtectionBadge({
  icon: Icon,
  label,
  active,
  triggered,
}: {
  icon: typeof ShieldCheck
  label: string
  active: boolean
  triggered?: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]",
        triggered
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : active
            ? "bg-muted text-muted-foreground"
            : "bg-muted text-muted-foreground/50",
      )}
    >
      {triggered ? (
        <Check className="size-2.5" aria-hidden="true" />
      ) : (
        <Icon className="size-2.5" aria-hidden="true" />
      )}
      {label}
    </span>
  )
}

function severityColor(severity: string): string {
  const map: Record<string, string> = {
    success: "bg-green-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
    info: "bg-blue-500",
  }
  return map[severity] ?? "bg-blue-500"
}

function formatHoldTime(h: number): string {
  if (h >= 24) return `${Math.round(h / 24)}d max`
  return `${h}h max`
}
