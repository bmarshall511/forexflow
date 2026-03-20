"use client"

import type { TradeFinderSetupData, PositionPriceTick } from "@fxflow/types"
import { TIMEFRAME_SET_MAP } from "@fxflow/types"
import { formatRelativeTime } from "@fxflow/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  ChevronDown,
  LineChart,
  Target,
  ShieldAlert,
  DollarSign,
  CheckCircle2,
  Zap,
  Clock,
  AlertCircle,
} from "lucide-react"
import { PriceCard, StatRow } from "@/components/ui/price-card"
import { SetupScoreBreakdown } from "./setup-score-breakdown"
import { StandaloneChart } from "@/components/charts/standalone-chart"
import { cn } from "@/lib/utils"
import { TF_LABELS, fmtDollar, computeDollarAmount } from "./setup-card"
import type { AutoTradeStatus } from "./setup-card"

interface SetupCardDetailsProps {
  setup: TradeFinderSetupData
  showChart: boolean
  onToggleChart: () => void
  lastTick: PositionPriceTick | null
  autoTradeStatus: AutoTradeStatus
}

export function SetupCardDetails({
  setup,
  showChart,
  onToggleChart,
  lastTick,
  autoTradeStatus,
}: SetupCardDetailsProps) {
  const isLong = setup.direction === "long"
  const riskDollars = computeDollarAmount(setup.positionSize, setup.riskPips, setup.instrument)
  const rewardDollars = computeDollarAmount(setup.positionSize, setup.rewardPips, setup.instrument)

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

  return (
    <div className="border-border/40 space-y-4 border-t px-4 pb-4 pt-4">
      {/* Management status indicators (moved from collapsed badges) */}
      {(setup.breakevenMoved || setup.partialTaken || autoTradeStatus) && (
        <div className="space-y-1">
          {setup.breakevenMoved && (
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-3.5" />
              <span>Safety net moved — you can&apos;t lose money on this trade</span>
            </div>
          )}
          {setup.partialTaken && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
              <CheckCircle2 className="size-3.5" />
              <span>Some profit locked in — part of the trade was closed</span>
            </div>
          )}
          {autoTradeStatus?.type === "eligible" && (
            <div className="flex items-start gap-1.5 text-xs text-teal-600 dark:text-teal-400">
              <Zap className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Ready for auto-trade
                {autoTradeStatus.reason ? ` — ${autoTradeStatus.reason.charAt(0).toLowerCase()}${autoTradeStatus.reason.slice(1)}` : ""}
              </span>
            </div>
          )}
          {autoTradeStatus?.type === "queued" && (
            <div className="flex items-start gap-1.5 text-xs text-blue-500">
              <Clock className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {autoTradeStatus.position != null ? `#${autoTradeStatus.position} in line — ` : ""}
                {autoTradeStatus.reason}
              </span>
            </div>
          )}
          {autoTradeStatus?.type === "blocked" && (
            <div className="flex items-start gap-1.5 text-xs text-amber-500">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>Can&apos;t auto-trade: {autoTradeStatus.reason.charAt(0).toLowerCase()}{autoTradeStatus.reason.slice(1)}</span>
            </div>
          )}
        </div>
      )}

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
          sublabel={`-${fmtDollar(riskDollars)} if wrong`}
          value={setup.stopLoss.toFixed(5)}
          color="text-red-500"
        />
        <PriceCard
          icon={<DollarSign className="size-3.5" />}
          label="Take Profit"
          sublabel={`+${fmtDollar(rewardDollars)} if right`}
          value={setup.takeProfit.toFixed(5)}
          color="text-green-500"
        />
      </div>

      {/* Position details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <StatRow label="Trade Size" value={`${setup.positionSize.toLocaleString()} units`} />
        <StatRow label="Risk:Reward" value={setup.rrRatio} />
        <StatRow label="Zone Type" value={setup.zone.formation.replace(/_/g, " ")} />
        <StatRow label="Distance" value={`${setup.distanceToEntryPips.toFixed(1)} pips away`} />
        {setup.placedAt && <StatRow label="Placed" value={formatRelativeTime(setup.placedAt)} />}
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
                    : setup.curveData.position === "high" || setup.curveData.position === "above"
                      ? "bg-red-500"
                      : "bg-amber-500",
                )}
              />
              <span>
                Price is in the{" "}
                <span className="font-medium">{setup.curveData.position}</span> zone of the bigger
                picture
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
          onClick={onToggleChart}
        >
          <LineChart className="size-3.5" />
          {showChart ? "Hide Chart" : "Show Chart"}
        </Button>
        <span className="text-muted-foreground text-[10px]">{chartTimeframe} timeframe</span>
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
    </div>
  )
}
