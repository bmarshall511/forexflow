"use client"

import type {
  SmartFlowConfigData,
  SmartFlowConfigRuntimeStatus,
  SmartFlowActivityEvent,
  SmartFlowTradeData,
} from "@fxflow/types"
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
  Activity,
  Pause,
  Play,
  Check,
  BarChart3,
  Gauge,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getTradePlanStatus } from "./trade-plan-status"
import { TradePlanLevels } from "./trade-plan-levels"

// ─── Constants ────────────────────────────────────────────────────────────────

const FALLBACK_PRESET = { label: "Custom", icon: Activity, color: "text-gray-500" } as const

const PRESET_META: Record<string, { label: string; icon: typeof Zap; color: string; bg: string }> =
  {
    momentum_catch: {
      label: "Momentum",
      icon: Zap,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    steady_growth: {
      label: "Steady Growth",
      icon: ShieldCheck,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    swing_capture: {
      label: "Swing Capture",
      icon: TrendingUp,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    trend_rider: {
      label: "Trend Rider",
      icon: Rocket,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    recovery: { label: "Recovery", icon: RotateCcw, color: "text-red-500", bg: "bg-red-500/10" },
    custom: { label: "Custom", icon: Activity, color: "text-gray-500", bg: "bg-gray-500/10" },
  }

const STATE_CONFIG = {
  trading: {
    gradient: "from-emerald-500/8 via-transparent",
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
    pulse: true,
    label: "LIVE",
    labelBg: "bg-emerald-500/15 text-emerald-500",
  },
  watching: {
    gradient: "from-blue-500/8 via-transparent",
    border: "border-blue-500/30",
    dot: "bg-blue-500",
    pulse: true,
    label: "WATCHING",
    labelBg: "bg-blue-500/15 text-blue-500",
  },
  paused: {
    gradient: "from-transparent",
    border: "border-border",
    dot: "bg-muted-foreground/40",
    pulse: false,
    label: "PAUSED",
    labelBg: "bg-muted text-muted-foreground",
  },
  pending: {
    gradient: "from-amber-500/8 via-transparent",
    border: "border-amber-500/30",
    dot: "bg-amber-500",
    pulse: false,
    label: "READY",
    labelBg: "bg-amber-500/15 text-amber-500",
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TradePlanCardProps {
  config: SmartFlowConfigData
  runtime: SmartFlowConfigRuntimeStatus | null
  latestActivity: SmartFlowActivityEvent | null
  activeTrade?: SmartFlowTradeData
  toggling: boolean
  onToggle: () => void
  onDelete: () => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TradePlanCard({
  config,
  runtime,
  latestActivity,
  activeTrade,
  toggling,
  onToggle,
  onDelete,
}: TradePlanCardProps) {
  const preset = PRESET_META[config.preset] ?? FALLBACK_PRESET
  const PresetIcon = preset.icon
  const status = getTradePlanStatus(config, runtime, activeTrade)
  const state = STATE_CONFIG[status.state]
  const isActive = config.isActive
  const isTrading = status.state === "trading" && activeTrade != null
  const hasTicks = runtime?.receiving_ticks ?? false

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border transition-all duration-200",
        "hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20",
        state.border,
        !isActive && "opacity-50 grayscale-[30%]",
      )}
    >
      {/* Gradient background accent */}
      <div
        className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", state.gradient)}
        aria-hidden="true"
      />

      <div className="relative">
        {/* ── Top bar: status + pair + direction ────────────────── */}
        <div className="flex items-center justify-between px-3.5 pt-3.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest",
              state.labelBg,
            )}
          >
            <span
              className={cn("size-1.5 rounded-full", state.dot, state.pulse && "animate-pulse")}
              aria-hidden="true"
            />
            {state.label}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold tracking-tight">
              {config.instrument.replace("_", "/")}
            </span>
            <DirectionBadge direction={config.direction} />
          </div>
        </div>

        {/* ── Strategy + status (combined for compactness) ───── */}
        <div className="px-3.5 pt-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                "bg" in preset ? preset.bg : "bg-muted",
              )}
            >
              <PresetIcon className={cn("size-2.5", preset.color)} aria-hidden="true" />
              <span className={cn("text-[10px] font-semibold", preset.color)}>{preset.label}</span>
            </div>
          </div>
          <p className="text-foreground mt-1.5 text-xs leading-snug">{status.description}</p>
        </div>

        {/* ── Trade levels (when actively trading) ─────────────── */}
        {isTrading && activeTrade != null && (
          <div className="px-3.5 pt-3">
            <TradePlanLevels
              config={config}
              trade={activeTrade}
              currentAtr={runtime?.currentAtr ?? null}
            />
          </div>
        )}

        {/* ── Live stats bar (only show when we have actual data) ── */}
        {isActive && (hasTicks || runtime?.currentAtr != null) && (
          <div className="mx-3.5 mt-2.5 flex items-center gap-3 text-[11px]">
            {runtime?.currentAtr != null && (
              <div className="flex items-center gap-1">
                <BarChart3 className="text-muted-foreground size-3" aria-hidden="true" />
                <span className="font-mono font-medium">{runtime.currentAtr.toFixed(0)}p</span>
              </div>
            )}
            {runtime?.currentSpread != null && (
              <div className="flex items-center gap-1">
                <Gauge className="text-muted-foreground size-3" aria-hidden="true" />
                <span className="font-mono font-medium">{runtime.currentSpread.toFixed(1)}p</span>
              </div>
            )}
            {hasTicks && (
              <div className="flex items-center gap-1">
                <span
                  className="size-1.5 animate-pulse rounded-full bg-emerald-500"
                  aria-hidden="true"
                />
                <span className="font-medium text-emerald-500">Live</span>
              </div>
            )}
          </div>
        )}

        {/* ── Protections row ──────────────────────────────────── */}
        {isActive && (
          <div className="flex flex-wrap gap-1 px-3.5 pt-2.5">
            <Shield
              label="Break-even"
              active={config.breakevenEnabled}
              triggered={activeTrade?.breakevenTriggered}
            />
            <Shield
              label="Trailing"
              active={config.trailingEnabled}
              triggered={activeTrade?.trailingActivated}
            />
            {config.newsProtectionEnabled && <Shield label="News" active />}
            {config.maxHoldHours != null && (
              <Shield label={formatHold(config.maxHoldHours)} active />
            )}
          </div>
        )}

        {/* ── Recent actions (when trading) ─────────────────────── */}
        {isTrading && activeTrade != null && activeTrade.managementLog.length > 0 && (
          <div className="mx-3.5 mt-2 space-y-0.5 border-t pt-2">
            {activeTrade.managementLog
              .slice(-3)
              .reverse()
              .map((entry, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <span className="text-muted-foreground/60 w-11 shrink-0 font-mono text-[10px]">
                    {new Date(entry.at).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-muted-foreground leading-snug">
                    {entry.detail || entry.action.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
          </div>
        )}

        {/* ── Latest activity (watching/paused) ────────────────── */}
        {!isTrading && latestActivity && (
          <div className="mx-3.5 mt-2 flex items-center gap-1.5 border-t pt-2 text-[11px]">
            <span
              className={cn("size-1.5 shrink-0 rounded-full", severityDot(latestActivity.severity))}
              aria-hidden="true"
            />
            <span className="text-muted-foreground truncate">{latestActivity.message}</span>
            <span className="text-muted-foreground/50 shrink-0">
              {formatRelativeTime(latestActivity.timestamp)}
            </span>
          </div>
        )}

        {/* ── Footer: actions ──────────────────────────────────── */}
        <div className="flex items-center justify-between px-3.5 pb-3 pt-3">
          <span className="text-muted-foreground/60 text-[10px]">
            {new Date(config.createdAt).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant={isActive ? "outline" : "default"}
              size="sm"
              className="h-8 gap-1.5 rounded-lg px-3 text-[11px]"
              disabled={toggling}
              onClick={onToggle}
            >
              {isActive ? (
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
              className="text-muted-foreground hover:text-destructive h-8 w-8 rounded-lg p-0"
              onClick={onDelete}
              aria-label={`Delete ${config.name}`}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Shield({
  label,
  active,
  triggered,
}: {
  label: string
  active: boolean
  triggered?: boolean
}) {
  if (!active) return null
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        triggered ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground",
      )}
    >
      {triggered ? <Check className="size-2.5" aria-hidden="true" /> : null}
      {label}
    </span>
  )
}

function severityDot(s: string): string {
  return (
    {
      success: "bg-emerald-500",
      warning: "bg-amber-500",
      error: "bg-red-500",
      info: "bg-blue-500",
    }[s] ?? "bg-blue-500"
  )
}

function formatHold(h: number): string {
  return h >= 24 ? `${Math.round(h / 24)}d limit` : `${h}h limit`
}
