"use client"

import { useState } from "react"
import type { TradeFinderSetupData } from "@fxflow/types"
import { TIMEFRAME_SET_MAP } from "@fxflow/types"
import { formatInstrument, getPipSize, formatRelativeTime } from "@fxflow/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  ChevronDown,
  LineChart,
  Target,
  ShieldAlert,
  DollarSign,
  Zap,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react"
import { PriceCard, StatRow } from "@/components/ui/price-card"
import { SetupScoreBreakdown } from "./setup-score-breakdown"
import { PlaceOrderDialog } from "./place-order-dialog"
import { usePositions } from "@/hooks/use-positions"
import { StandaloneChart } from "@/components/charts/standalone-chart"
import { cn } from "@/lib/utils"

interface AutoTradeConfig {
  autoTradeEnabled: boolean
  autoTradeMinScore: number
  autoTradeMinRR: number
}

interface SetupCardProps {
  setup: TradeFinderSetupData
  onPlace?: (setupId: string, orderType: "MARKET" | "LIMIT") => void
  autoTradeConfig?: AutoTradeConfig
}

const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  active: { className: "bg-blue-500/10 text-blue-500 border-blue-500/20", label: "Watching" },
  approaching: {
    className: "bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse",
    label: "Approaching",
  },
  placed: { className: "bg-teal-500/10 text-teal-500 border-teal-500/20", label: "Pending" },
  filled: { className: "bg-green-500/10 text-green-500 border-green-500/20", label: "Filled" },
  invalidated: { className: "bg-red-500/10 text-red-500 border-red-500/20", label: "Invalidated" },
  expired: { className: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20", label: "Expired" },
}

const TF_LABELS: Record<string, string> = {
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
}

function fmtDollar(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`
  return `$${amount.toFixed(2)}`
}

function computeDollarAmount(positionSize: number, pips: number, instrument: string): number {
  const pipSize = getPipSize(instrument)
  return positionSize * pips * pipSize
}

type AutoTradeStatus =
  | { type: "eligible" }
  | { type: "queued"; position: number | null; reason: string }
  | { type: "blocked"; reason: string }
  | null

const CAP_KEYWORDS = ["concurrent", "daily", "risk"]

function isCappedReason(reason: string): boolean {
  const lower = reason.toLowerCase()
  return CAP_KEYWORDS.some((kw) => lower.includes(kw))
}

function getAutoTradeStatus(setup: TradeFinderSetupData, config: AutoTradeConfig): AutoTradeStatus {
  if (!config.autoTradeEnabled) return null
  if (setup.status === "placed" || setup.status === "filled") return null
  if (setup.autoPlaced) return null
  if (setup.status !== "active" && setup.status !== "approaching") return null

  // Check client-side gates first
  if (setup.scores.total < config.autoTradeMinScore) {
    return {
      type: "blocked",
      reason: `Score ${setup.scores.total} below threshold ${config.autoTradeMinScore}`,
    }
  }

  const rrNum = parseFloat(setup.rrRatio)
  if (!isNaN(rrNum) && rrNum < config.autoTradeMinRR) {
    return { type: "blocked", reason: `R:R ${setup.rrRatio} below min ${config.autoTradeMinRR}:1` }
  }

  // Server-side skip reason from DB/WS
  if (setup.lastSkipReason) {
    if (isCappedReason(setup.lastSkipReason)) {
      return {
        type: "queued",
        position: setup.queuePosition,
        reason: setup.lastSkipReason,
      }
    }
    return { type: "blocked", reason: setup.lastSkipReason }
  }

  // Queue position without skip reason = queued from queue computation
  if (setup.queuePosition != null) {
    return { type: "queued", position: setup.queuePosition, reason: "Waiting for cap slot" }
  }

  return { type: "eligible" }
}

export function SetupCard({ setup, onPlace, autoTradeConfig }: SetupCardProps) {
  const [open, setOpen] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    orderType: "MARKET" | "LIMIT"
  }>({ open: false, orderType: "LIMIT" })
  const [isPlacing, setIsPlacing] = useState(false)
  const isLong = setup.direction === "long"
  const scorePct = Math.round((setup.scores.total / setup.scores.maxPossible) * 100)
  const scoreColor =
    scorePct >= 75 ? "text-green-500" : scorePct >= 58 ? "text-amber-500" : "text-orange-500"
  const scoreBg =
    scorePct >= 75 ? "bg-green-500/10" : scorePct >= 58 ? "bg-amber-500/10" : "bg-orange-500/10"

  const { pricesByInstrument } = usePositions()
  const lastTick = pricesByInstrument.get(setup.instrument) ?? null

  const tfSet = TIMEFRAME_SET_MAP[setup.timeframeSet]
  const chartTimeframe = tfSet?.ltf ?? "M15"

  const orderOverlay = {
    direction: setup.direction,
    orderType: "LIMIT" as const,
    entryPrice: setup.entryPrice,
    stopLoss: setup.stopLoss,
    takeProfit: setup.takeProfit,
    onDraftChange: () => {},
  }

  const riskDollars = computeDollarAmount(setup.positionSize, setup.riskPips, setup.instrument)
  const rewardDollars = computeDollarAmount(setup.positionSize, setup.rewardPips, setup.instrument)
  const statusInfo = STATUS_STYLES[setup.status] ?? { className: "", label: setup.status }

  // Auto-trade status: eligible / queued / blocked (combines client + server-side checks)
  const autoTradeStatus = autoTradeConfig ? getAutoTradeStatus(setup, autoTradeConfig) : null

  const handlePlaceClick = (orderType: "MARKET" | "LIMIT") => {
    setConfirmDialog({ open: true, orderType })
  }

  const handleConfirm = async () => {
    if (!onPlace) return
    setIsPlacing(true)
    try {
      await onPlace(setup.id, confirmDialog.orderType)
      setConfirmDialog({ open: false, orderType: "LIMIT" })
    } finally {
      setIsPlacing(false)
    }
  }

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div
          className={cn(
            "border-border/60 bg-card overflow-hidden rounded-xl border border-l-[3px]",
            setup.autoPlaced && setup.status === "placed"
              ? "border-l-teal-500"
              : setup.autoPlaced && setup.status === "filled"
                ? "border-l-green-500"
                : isLong
                  ? "border-l-green-500"
                  : "border-l-red-500",
          )}
        >
          {/* ─── Collapsed Header ─── */}
          <CollapsibleTrigger asChild>
            <button className="hover:bg-muted/30 flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors">
              {/* Main info */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold tracking-tight">
                    {formatInstrument(setup.instrument)}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-0 px-1.5 py-0 text-[10px] font-semibold",
                      isLong ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500",
                    )}
                  >
                    {isLong ? "BUY" : "SELL"}
                  </Badge>
                  {/* Status + auto-trade lifecycle badges */}
                  {setup.autoPlaced && setup.status === "placed" ? (
                    <Badge
                      variant="outline"
                      className="gap-0.5 border-teal-500/20 bg-teal-500/10 px-1.5 py-0 text-[10px] text-teal-500"
                    >
                      <Clock className="size-2.5" />
                      Order Pending
                    </Badge>
                  ) : setup.autoPlaced && setup.status === "filled" ? (
                    <Badge
                      variant="outline"
                      className="gap-0.5 border-green-500/20 bg-green-500/10 px-1.5 py-0 text-[10px] text-green-500"
                    >
                      <CheckCircle2 className="size-2.5" />
                      Trade Filled
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className={cn("px-1.5 py-0 text-[10px]", statusInfo.className)}
                    >
                      {statusInfo.label}
                    </Badge>
                  )}
                  {setup.autoPlaced && (
                    <Badge
                      variant="outline"
                      className="gap-0.5 border-teal-500/20 bg-teal-500/10 px-1.5 py-0 text-[10px] text-teal-500"
                    >
                      <Zap className="size-2.5" />
                      Auto
                    </Badge>
                  )}
                  {/* Auto-trade status badge: Eligible / Queued / Blocked */}
                  {autoTradeStatus?.type === "eligible" && (
                    <Badge
                      variant="outline"
                      className="gap-0.5 border-teal-500/20 bg-teal-500/5 px-1.5 py-0 text-[10px] text-teal-600 dark:text-teal-400"
                    >
                      <Zap className="size-2.5" />
                      Eligible
                    </Badge>
                  )}
                  {autoTradeStatus?.type === "queued" && (
                    <Badge
                      variant="outline"
                      className="gap-0.5 border-blue-500/20 bg-blue-500/10 px-1.5 py-0 text-[10px] text-blue-500"
                    >
                      <Clock className="size-2.5" />
                      Queued
                      {autoTradeStatus.position != null ? ` #${autoTradeStatus.position}` : ""}
                    </Badge>
                  )}
                  {autoTradeStatus?.type === "blocked" && (
                    <Badge
                      variant="outline"
                      className="gap-0.5 border-amber-500/20 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-500"
                    >
                      <AlertCircle className="size-2.5" />
                      Blocked
                    </Badge>
                  )}
                </div>
                {/* Skip/block reason subtitle */}
                {(autoTradeStatus?.type === "queued" || autoTradeStatus?.type === "blocked") && (
                  <div className="mt-0.5 flex items-center gap-1">
                    <AlertCircle className="size-3 shrink-0 text-amber-500" />
                    <span className="truncate text-[10px] text-amber-500">
                      {autoTradeStatus.reason}
                    </span>
                  </div>
                )}
                {/* Risk / Reward summary visible on header */}
                <div className="mt-1 flex items-center gap-3 text-[11px]">
                  <span className="font-medium text-red-500">Risk {fmtDollar(riskDollars)}</span>
                  <span className="font-medium text-green-500">
                    Reward {fmtDollar(rewardDollars)}
                  </span>
                  <span className="text-muted-foreground">R:R {setup.rrRatio}</span>
                  <span className="text-muted-foreground">
                    {setup.distanceToEntryPips.toFixed(0)}p away
                  </span>
                </div>
              </div>

              {/* Score circle */}
              <div
                className={cn(
                  "flex size-10 shrink-0 flex-col items-center justify-center rounded-full",
                  scoreBg,
                )}
              >
                <span
                  className={cn(
                    "font-mono text-sm font-bold tabular-nums leading-none",
                    scoreColor,
                  )}
                >
                  {setup.scores.total}
                </span>
                <span className="text-muted-foreground mt-0.5 text-[8px] leading-none">
                  /{setup.scores.maxPossible}
                </span>
              </div>

              <ChevronDown
                className={cn(
                  "text-muted-foreground size-4 shrink-0 transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>

          {/* ─── Expanded Content ─── */}
          <CollapsibleContent>
            <div className="border-border/40 space-y-4 border-t px-4 pb-4 pt-4">
              {/* Risk / Reward visual bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span>Risk vs Reward</span>
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    {TF_LABELS[setup.timeframeSet] ?? setup.timeframeSet}
                  </Badge>
                </div>
                <div className="flex h-6 gap-0.5 overflow-hidden rounded-lg">
                  <div
                    className="flex items-center justify-center rounded-l-lg bg-red-500/15 text-[10px] font-semibold text-red-500"
                    style={{
                      width: `${Math.max(25, Math.min(50, (1 / (1 + parseFloat(setup.rrRatio))) * 100))}%`,
                    }}
                  >
                    -{fmtDollar(riskDollars)}
                  </div>
                  <div className="flex flex-1 items-center justify-center rounded-r-lg bg-green-500/15 text-[10px] font-semibold text-green-500">
                    +{fmtDollar(rewardDollars)}
                  </div>
                </div>
                <div className="text-muted-foreground flex justify-between text-[10px]">
                  <span>Could lose {setup.riskPips.toFixed(1)} pips</span>
                  <span>Could gain {setup.rewardPips.toFixed(1)} pips</span>
                </div>
              </div>

              {/* Entry / SL / TP grid */}
              <div className="grid grid-cols-3 gap-2">
                <PriceCard
                  icon={<Target className="size-3.5" />}
                  label="Entry Price"
                  sublabel={isLong ? "Buy here" : "Sell here"}
                  value={setup.entryPrice.toFixed(5)}
                  color="text-amber-500"
                />
                <PriceCard
                  icon={<ShieldAlert className="size-3.5" />}
                  label="Stop Loss"
                  sublabel="Auto-close if wrong"
                  value={setup.stopLoss.toFixed(5)}
                  color="text-red-500"
                />
                <PriceCard
                  icon={<DollarSign className="size-3.5" />}
                  label="Take Profit"
                  sublabel="Auto-close if right"
                  value={setup.takeProfit.toFixed(5)}
                  color="text-green-500"
                />
              </div>

              {/* Position details */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                <StatRow
                  label="Trade Size"
                  value={`${setup.positionSize.toLocaleString()} units`}
                />
                <StatRow label="Risk:Reward" value={setup.rrRatio} />
                <StatRow label="Zone Type" value={setup.zone.formation.replace(/_/g, " ")} />
                <StatRow
                  label="Distance"
                  value={`${setup.distanceToEntryPips.toFixed(1)} pips away`}
                />
                {setup.placedAt && (
                  <StatRow label="Placed" value={formatRelativeTime(setup.placedAt)} />
                )}
              </div>

              {/* Trend & Curve - plain language */}
              {(setup.trendData || setup.curveData) && (
                <div className="space-y-1.5 rounded-md border p-2.5">
                  <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                    Market Context
                  </p>
                  {setup.trendData && (
                    <div className="flex items-center gap-2 text-xs">
                      <div
                        className={cn(
                          "size-2 rounded-full",
                          setup.trendData.direction === "up"
                            ? "bg-green-500"
                            : setup.trendData.direction === "down"
                              ? "bg-red-500"
                              : "bg-zinc-400",
                        )}
                      />
                      <span>
                        Trend is going{" "}
                        <span className="font-medium">
                          {setup.trendData.direction === "up"
                            ? "up"
                            : setup.trendData.direction === "down"
                              ? "down"
                              : "sideways"}
                        </span>{" "}
                        ({setup.trendData.status})
                      </span>
                    </div>
                  )}
                  {setup.curveData && (
                    <div className="flex items-center gap-2 text-xs">
                      <div
                        className={cn(
                          "size-2 rounded-full",
                          setup.curveData.position === "low" || setup.curveData.position === "below"
                            ? "bg-green-500"
                            : setup.curveData.position === "high" ||
                                setup.curveData.position === "above"
                              ? "bg-red-500"
                              : "bg-amber-500",
                        )}
                      />
                      <span>
                        Price is in the{" "}
                        <span className="font-medium">{setup.curveData.position}</span> zone of the
                        bigger picture
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Chart toggle */}
              <div className="flex items-center justify-between">
                <Button
                  variant={showChart ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setShowChart(!showChart)}
                >
                  <LineChart className="size-3.5" />
                  {showChart ? "Hide Chart" : "Show Chart"}
                </Button>
                <span className="text-muted-foreground text-[10px]">
                  {chartTimeframe} timeframe
                </span>
              </div>

              {showChart && (
                <div className="bg-background h-[280px] overflow-hidden rounded-md border">
                  <StandaloneChart
                    instrument={setup.instrument}
                    timeframe={chartTimeframe}
                    lastTick={lastTick}
                    orderOverlay={orderOverlay}
                    zones={[setup.zone]}
                    currentPrice={lastTick?.bid ?? null}
                    curveData={setup.curveData}
                    trendData={setup.trendData}
                  />
                </div>
              )}

              {/* Score Breakdown */}
              <Collapsible>
                <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors">
                  <ChevronDown className="size-3" />
                  <span>Score Breakdown</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <SetupScoreBreakdown scores={setup.scores} />
                </CollapsibleContent>
              </Collapsible>

              {/* Actions — opens confirmation dialog */}
              {(setup.status === "active" || setup.status === "approaching") && onPlace && (
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 flex-1 gap-1.5 text-xs"
                    onClick={() => handlePlaceClick("LIMIT")}
                  >
                    Place Limit Order
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => handlePlaceClick("MARKET")}
                  >
                    Market Order
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Confirmation dialog */}
      <PlaceOrderDialog
        setup={setup}
        orderType={confirmDialog.orderType}
        open={confirmDialog.open}
        onOpenChange={(v) => setConfirmDialog((prev) => ({ ...prev, open: v }))}
        onConfirm={handleConfirm}
        isPlacing={isPlacing}
      />
    </>
  )
}
