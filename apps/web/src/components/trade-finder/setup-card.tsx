"use client"

import type { TradeFinderSetupData } from "@fxflow/types"
import { TIMEFRAME_SET_MAP } from "@fxflow/types"
import { formatInstrument, getPipSize } from "@fxflow/shared"
import { Progress } from "@/components/ui/progress"
import { Zap, AlertCircle } from "lucide-react"
import { useDaemonConnection } from "@/hooks/use-daemon-connection"
import { cn } from "@/lib/utils"
import { StandaloneChart } from "@/components/charts/standalone-chart"
import { Button } from "@/components/ui/button"
import {
  STATUS_STYLES,
  fmtDollar,
  computeDollarAmount,
  getAutoTradeStatus,
} from "./setup-card-utils"
import type { AutoTradeConfig } from "./setup-card-utils"

// Re-export shared utilities for backward compatibility
export {
  STATUS_STYLES,
  TF_LABELS,
  fmtDollar,
  computeDollarAmount,
  getAutoTradeStatus,
} from "./setup-card-utils"
export type { AutoTradeConfig, AutoTradeStatus } from "./setup-card-utils"

interface SetupCardProps {
  setup: TradeFinderSetupData
  onSelect: (setup: TradeFinderSetupData) => void
  onPlace?: (setupId: string, orderType: "MARKET" | "LIMIT") => void
  autoTradeConfig?: AutoTradeConfig
}

export function SetupCard({ setup, onSelect, onPlace, autoTradeConfig }: SetupCardProps) {
  const isLong = setup.direction === "long"
  const scorePct = Math.round((setup.scores.total / setup.scores.maxPossible) * 100)
  const scoreColor =
    scorePct >= 75 ? "text-green-500" : scorePct >= 58 ? "text-amber-500" : "text-orange-500"
  const scoreIndicator =
    scorePct >= 75 ? "bg-green-500" : scorePct >= 58 ? "bg-amber-500" : "bg-orange-500"

  // Get live prices from both position and chart streams for maximum coverage
  const { positionsPrices, chartPrices } = useDaemonConnection()
  const lastTick =
    positionsPrices?.prices?.find((p) => p.instrument === setup.instrument) ??
    chartPrices?.prices?.find((p) => p.instrument === setup.instrument) ??
    null

  // Live distance from current price to entry (updates every tick)
  const pipSize = getPipSize(setup.instrument)
  const livePrice = lastTick?.bid ?? null
  const liveDistancePips = livePrice
    ? Math.abs(livePrice - setup.entryPrice) / pipSize
    : setup.distanceToEntryPips

  const riskDollars = computeDollarAmount(setup.positionSize, setup.riskPips, setup.instrument)
  const rewardDollars = computeDollarAmount(setup.positionSize, setup.rewardPips, setup.instrument)

  const autoTradeStatus = autoTradeConfig ? getAutoTradeStatus(setup, autoTradeConfig, liveDistancePips) : null

  const statusLabel = (() => {
    if (setup.autoPlaced && setup.status === "filled") return "Auto Filled"
    if (setup.autoPlaced && setup.status === "placed") return "Auto Pending"
    return STATUS_STYLES[setup.status]?.label ?? setup.status
  })()

  const statusIcon = setup.autoPlaced && (setup.status === "placed" || setup.status === "filled")
    ? <Zap className="size-2.5" />
    : null

  const isApproaching = setup.status === "approaching"
  const canPlace = (setup.status === "active" || setup.status === "approaching") && !!onPlace

  const tfSet = TIMEFRAME_SET_MAP[setup.timeframeSet]
  const chartTimeframe = tfSet?.ltf ?? "M15"

  return (
    <div
      className={cn(
        "bg-card flex cursor-pointer flex-col overflow-hidden rounded-xl border border-l-4 shadow-sm transition-shadow hover:shadow-md",
        setup.autoPlaced && setup.status === "placed"
          ? "border-l-teal-500 border-border/60"
          : setup.autoPlaced && setup.status === "filled"
            ? "border-l-green-500 border-border/60"
            : isLong
              ? "border-l-green-500 border-border/60"
              : "border-l-red-500 border-border/60",
        isApproaching && "ring-2 ring-amber-500/30",
      )}
      onClick={() => onSelect(setup)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(setup)
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${formatInstrument(setup.instrument)} ${isLong ? "Buy" : "Sell"} setup, score ${setup.scores.total} of ${setup.scores.maxPossible}. ${statusLabel}. Tap to view details.`}
    >
      {/* Header: pair + score */}
      <div className="flex items-start justify-between px-4 pt-4">
        <div className="min-w-0 space-y-0.5">
          <span className="text-lg font-bold tracking-tight">
            {formatInstrument(setup.instrument)}
          </span>
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            {statusIcon}
            <span className={cn(isLong ? "text-green-500" : "text-red-500", "font-semibold")}>
              {isLong ? "Buy" : "Sell"}
            </span>
            <span className="text-muted-foreground/40">&middot;</span>
            <span
              className={cn(
                setup.status === "approaching" && "text-amber-500",
                setup.status === "placed" && "text-teal-500",
                setup.status === "filled" && "text-green-500",
                setup.status === "invalidated" && "text-red-500",
              )}
            >
              {statusLabel}
            </span>
            <span className="text-muted-foreground/40">/{setup.scores.maxPossible}</span>
          </div>
        </div>
        <span className={cn("font-mono text-xl font-bold tabular-nums leading-none", scoreColor)}>
          {setup.scores.total}
        </span>
      </div>

      {/* Mini chart */}
      <div className="pointer-events-none px-4 pt-3">
        <div className="bg-background h-[120px] overflow-hidden rounded-lg border">
          <StandaloneChart
            key={`mini-${setup.instrument}-${chartTimeframe}`}
            instrument={setup.instrument}
            timeframe={chartTimeframe}
            lastTick={lastTick}
            zones={[setup.zone]}
            currentPrice={lastTick?.bid ?? setup.entryPrice}
            loadDelay={100}
          />
        </div>
      </div>

      {/* Score progress bar */}
      <div className="space-y-1 px-4 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
            Score
          </span>
          <span className="text-muted-foreground text-[10px]">
            {setup.scores.total}/{setup.scores.maxPossible}
          </span>
        </div>
        <Progress
          value={setup.scores.total}
          max={setup.scores.maxPossible}
          className="h-1.5"
          indicatorClassName={scoreIndicator}
        />
      </div>

      {/* Risk / Reward metrics */}
      <div className="space-y-1.5 px-4 pt-3">
        <MetricRow label="Risk" value={fmtDollar(riskDollars)} color="red" />
        <MetricRow label="Reward" value={fmtDollar(rewardDollars)} color="green" />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">R:R</span>
          <span className="font-mono font-medium">{setup.rrRatio}</span>
        </div>
      </div>

      {/* Distance + live price */}
      <div className="flex items-center justify-between px-4 pt-2">
        <p className="text-muted-foreground text-xs">
          {liveDistancePips < 1
            ? "At the entry zone"
            : liveDistancePips < 10
              ? `${liveDistancePips.toFixed(1)} pips from entry`
              : `${liveDistancePips.toFixed(0)} pips from entry`}
        </p>
        {livePrice && (
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
            {livePrice.toFixed(setup.instrument.includes("JPY") ? 3 : 5)}
          </span>
        )}
      </div>

      {/* Auto-trade status context */}
      {autoTradeStatus?.reason && (
        <div className="flex items-start gap-1.5 px-4 pt-2">
          <AlertCircle
            className={cn(
              "mt-0.5 size-3 shrink-0",
              autoTradeStatus.type === "blocked" ? "text-amber-500" : "text-blue-400",
            )}
          />
          <span
            className={cn(
              "line-clamp-2 text-[11px] leading-snug",
              autoTradeStatus.type === "blocked" ? "text-amber-500" : "text-blue-400",
            )}
          >
            {autoTradeStatus.reason}
          </span>
        </div>
      )}

      {/* Action button */}
      <div className="mt-auto px-4 pb-4 pt-3">
        {canPlace && isApproaching ? (
          <Button
            variant="default"
            size="sm"
            className="h-10 w-full text-sm font-medium"
            onClick={(e) => {
              e.stopPropagation()
              onPlace(setup.id, "LIMIT")
            }}
          >
            Place Trade
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-full text-sm font-medium"
            onClick={(e) => {
              e.stopPropagation()
              onSelect(setup)
            }}
          >
            View Details &rarr;
          </Button>
        )}
      </div>
    </div>
  )
}

function MetricRow({ label, value, color }: { label: string; value: string; color: "red" | "green" }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-medium">
        <span className={color === "red" ? "text-red-500" : "text-green-500"}>{value}</span>
        <span className={cn("inline-block size-2 rounded-full", color === "red" ? "bg-red-500" : "bg-green-500")} />
      </span>
    </div>
  )
}
