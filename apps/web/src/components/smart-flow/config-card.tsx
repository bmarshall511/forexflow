"use client"

import type {
  SmartFlowConfigData,
  SmartFlowPreset,
  SmartFlowConfigRuntimeStatus,
  SmartFlowActivityEvent,
} from "@fxflow/types"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { DirectionBadge } from "@/components/positions/direction-badge"
import { formatRelativeTime } from "@fxflow/shared"
import {
  Trash2,
  ShieldCheck,
  TrendingUp,
  Zap,
  Rocket,
  RotateCcw,
  Target,
  Clock,
  BarChart3,
  Gauge,
  Radio,
  Activity,
  Pause,
  Play,
  Sparkles,
  ShieldAlert,
  ArrowUpDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

const PRESET_META: Record<SmartFlowPreset, { label: string; icon: typeof Zap; color: string }> = {
  momentum_catch: { label: "Momentum", icon: Zap, color: "text-amber-500" },
  steady_growth: { label: "Steady Growth", icon: ShieldCheck, color: "text-emerald-500" },
  swing_capture: { label: "Swing", icon: TrendingUp, color: "text-blue-500" },
  trend_rider: { label: "Trend Rider", icon: Rocket, color: "text-purple-500" },
  recovery: { label: "Recovery", icon: RotateCcw, color: "text-red-500" },
  custom: { label: "Custom", icon: Activity, color: "text-gray-500" },
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
  const preset = PRESET_META[config.preset] ?? PRESET_META.custom
  const PresetIcon = preset.icon
  const isActive = config.isActive
  const hasTicks = runtime?.receiving_ticks ?? false
  const hasAtr = runtime?.currentAtr != null
  const hasSpread = runtime?.currentSpread != null

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all",
        isActive
          ? "border-l-4 border-l-emerald-500 dark:border-l-emerald-400"
          : "border-l-4 border-l-transparent opacity-60",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-2 pt-4">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            isActive ? "bg-primary/10" : "bg-muted",
          )}
        >
          <PresetIcon className={cn("size-4", isActive ? preset.color : "text-muted-foreground")} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {config.instrument.replace("_", "/")}
            </span>
            <DirectionBadge direction={config.direction} />
            <StatusDot hasTicks={hasTicks} isActive={isActive} />
          </div>
          <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
            <span className={cn("font-medium", preset.color)}>{preset.label}</span>
            <span className="text-border">|</span>
            <span>{config.name}</span>
          </div>
        </div>
      </div>

      {/* Strategy settings grid */}
      <div className="bg-border mx-4 mt-2 grid grid-cols-4 gap-px overflow-hidden rounded-lg border">
        <MetricCell icon={Target} label="SL" value={fmtAtr(config.stopLossAtrMultiple)} />
        <MetricCell icon={TrendingUp} label="TP" value={fmtAtr(config.takeProfitAtrMultiple)} />
        <MetricCell
          icon={ShieldCheck}
          label="BE"
          value={config.breakevenEnabled ? "On" : "Off"}
          active={config.breakevenEnabled}
        />
        <MetricCell
          icon={ArrowUpDown}
          label="Trail"
          value={config.trailingEnabled ? "On" : "Off"}
          active={config.trailingEnabled}
        />
      </div>

      {/* Live data section — only for active configs */}
      {isActive && (
        <div className="mx-4 mt-3 space-y-2">
          {/* ATR + Spread + Tick strip */}
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            {hasAtr && (
              <span className="flex items-center gap-1">
                <BarChart3 className="text-muted-foreground size-3" />
                <span className="text-muted-foreground">ATR</span>
                <span className="font-mono font-medium">{runtime!.currentAtr!.toFixed(0)}p</span>
              </span>
            )}
            {hasSpread && (
              <span className="flex items-center gap-1">
                <Gauge className="text-muted-foreground size-3" />
                <span className="text-muted-foreground">Spread</span>
                <span className="font-mono font-medium">{runtime!.currentSpread!.toFixed(1)}p</span>
                <SpreadBadge status={runtime!.spreadStatus} />
              </span>
            )}
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "inline-block size-1.5 rounded-full",
                  hasTicks ? "animate-pulse bg-green-500" : "bg-muted-foreground/40",
                )}
              />
              <span className="text-muted-foreground">{hasTicks ? "Live" : "No signal"}</span>
            </span>
          </div>

          {/* Management phase bar */}
          {runtime?.managementPhase && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="shrink-0 gap-1 px-1.5 py-0 text-[10px]">
                <Activity className="size-2.5" />
                {formatPhase(runtime.managementPhase)}
              </Badge>
              <Progress value={phaseProgress(runtime.managementPhase)} className="h-1 flex-1" />
            </div>
          )}

          {/* Safety net indicators */}
          <div className="flex flex-wrap gap-1.5">
            {config.maxDrawdownPercent != null && (
              <SafetyTag icon={ShieldAlert} label={`Max DD: ${config.maxDrawdownPercent}%`} />
            )}
            {config.maxHoldHours != null && (
              <SafetyTag icon={Clock} label={`Max hold: ${formatHours(config.maxHoldHours)}`} />
            )}
            {config.newsProtectionEnabled && <SafetyTag icon={Radio} label="News protected" />}
            {config.recoveryEnabled && (
              <SafetyTag
                icon={RotateCcw}
                label={`Recovery: ${config.recoveryMaxLevels} levels`}
                active
              />
            )}
            {config.aiMode !== "off" && (
              <SafetyTag icon={Sparkles} label={`AI: ${formatAiMode(config.aiMode)}`} />
            )}
          </div>
        </div>
      )}

      {/* Latest activity */}
      {latestActivity && (
        <div className="mx-4 mt-2 flex items-center gap-1.5 text-[11px]">
          <span
            className={cn(
              "inline-block size-1.5 shrink-0 rounded-full",
              latestActivity.severity === "success"
                ? "bg-green-500"
                : latestActivity.severity === "warning"
                  ? "bg-amber-500"
                  : latestActivity.severity === "error"
                    ? "bg-red-500"
                    : "bg-blue-500",
            )}
          />
          <span className="text-muted-foreground truncate">{latestActivity.message}</span>
          <span className="text-muted-foreground/60 shrink-0">
            {formatRelativeTime(latestActivity.timestamp)}
          </span>
        </div>
      )}

      {/* Footer */}
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
                <Pause className="size-3" /> Pause
              </>
            ) : (
              <>
                <Play className="size-3" /> Activate
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
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────

function StatusDot({ hasTicks, isActive }: { hasTicks: boolean; isActive: boolean }) {
  if (!isActive)
    return <span className="bg-muted-foreground/40 size-2 rounded-full" aria-label="Paused" />
  if (hasTicks)
    return <span className="size-2 animate-pulse rounded-full bg-green-500" aria-label="Live" />
  return <span className="size-2 rounded-full bg-amber-500" aria-label="Waiting" />
}

function MetricCell({
  icon: Icon,
  label,
  value,
  active,
}: {
  icon: typeof Target
  label: string
  value: string
  active?: boolean
}) {
  return (
    <div className="bg-card flex flex-col items-center gap-0.5 py-2">
      <Icon className={cn("size-3", active ? "text-primary" : "text-muted-foreground")} />
      <span className="text-foreground text-[11px] font-medium">{value}</span>
      <span className="text-muted-foreground text-[9px]">{label}</span>
    </div>
  )
}

function SpreadBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    normal: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    elevated: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    blocked: "bg-red-500/10 text-red-600 dark:text-red-400",
  }
  return (
    <span
      className={cn("rounded px-1 py-px text-[9px] font-medium", styles[status] ?? styles.normal)}
    >
      {status === "normal" ? "OK" : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function SafetyTag({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof ShieldAlert
  label: string
  active?: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]",
        active
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-2.5" />
      {label}
    </span>
  )
}

function fmtAtr(v: number | null | undefined): string {
  return v != null ? `${v.toFixed(1)}x` : "--"
}

function formatPhase(phase: string): string {
  return phase.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function phaseProgress(phase: string): number {
  const map: Record<string, number> = {
    entry: 10,
    breakeven: 35,
    trailing: 55,
    partial: 70,
    recovery: 50,
    safety_net: 90,
    target: 100,
  }
  return map[phase] ?? 20
}

function formatHours(h: number): string {
  if (h >= 24) return `${Math.round(h / 24)}d`
  return `${h}h`
}

function formatAiMode(mode: string): string {
  const map: Record<string, string> = {
    suggest: "Suggest",
    auto_selective: "Auto",
    full_auto: "Full Auto",
  }
  return map[mode] ?? mode
}
