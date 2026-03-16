"use client"

import type {
  PendingOrderData,
  OpenTradeData,
  ClosedTradeData,
  TradeTagData,
  AiAnalysisData,
} from "@fxflow/types"
import type { ActiveAnalysisProgress } from "@/hooks/use-active-ai-analyses"
import {
  formatCurrency,
  formatPips,
  getDecimalPlaces,
  formatShortDateTime,
  calculateRiskReward,
  getPipSize,
  TIMEFRAME_OPTIONS,
} from "@fxflow/shared"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { SourceBadge } from "./source-badge"
import { OutcomeBadge } from "./outcome-badge"
import { TagBadges } from "./tag-badges"
import { OpenProgressBar } from "./progress-bar-open"
import { PendingProgressBar } from "./progress-bar-pending"
import { DurationDisplay } from "./duration-display"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { PriceCard, StatRow } from "@/components/ui/price-card"
import { Eye, XCircle, Sparkles, ChevronDown, Target, ShieldAlert, DollarSign } from "lucide-react"
import { cn } from "@/lib/utils"

type TradeCardVariant = "pending" | "open" | "closed"
type TradeData = PendingOrderData | OpenTradeData | ClosedTradeData

interface TradeCardProps {
  variant: TradeCardVariant
  data: TradeData
  currency?: string
  /** Current market price for pending orders (from live price feed) */
  currentPrice?: number | null
  isExpanded: boolean
  onToggleExpand: () => void
  onViewDetails?: () => void
  onCloseTrade?: () => void
  onCancelOrder?: () => void
  onAiAnalysis?: () => void
  onTagMutated?: () => void
  tags?: TradeTagData[]
  latestAnalysis?: AiAnalysisData
  analysisCount?: number
  activeAiProgress?: ActiveAnalysisProgress
}

function fmtDollar(amount: number): string {
  if (Math.abs(amount) >= 1000) return `$${(amount / 1000).toFixed(1)}k`
  return `$${Math.abs(amount).toFixed(2)}`
}

function computeDollarAmount(units: number, pips: number, instrument: string): number {
  const pipSize = getPipSize(instrument)
  return Math.abs(units) * pips * pipSize
}

function getEntryPrice(data: TradeData, variant: TradeCardVariant): number {
  if (variant === "pending") return (data as PendingOrderData).entryPrice
  if (variant === "open") return (data as OpenTradeData).entryPrice
  return (data as ClosedTradeData).entryPrice
}

function getUnits(data: TradeData, variant: TradeCardVariant): number {
  if (variant === "pending") return (data as PendingOrderData).units
  if (variant === "open") return (data as OpenTradeData).currentUnits
  return (data as ClosedTradeData).units
}

export function TradeCard({
  variant,
  data,
  currency = "USD",
  currentPrice: currentPriceProp,
  isExpanded,
  onToggleExpand,
  onViewDetails,
  onCloseTrade,
  onCancelOrder,
  onAiAnalysis,
  tags,
  latestAnalysis,
  analysisCount,
  activeAiProgress,
}: TradeCardProps) {
  const pair = data.instrument.replace("_", "/")
  const isOpen = variant === "open"
  const isClosed = variant === "closed"
  const isPending = variant === "pending"
  const decimals = getDecimalPlaces(data.instrument)
  const isLong = data.direction === "long"

  const entryPrice = getEntryPrice(data, variant)
  const units = getUnits(data, variant)

  // P/L
  const plValue = isOpen
    ? (data as OpenTradeData).unrealizedPL
    : isClosed
      ? (data as ClosedTradeData).realizedPL
      : 0
  const isPositive = plValue >= 0.005
  const isNegative = plValue <= -0.005
  const plColor = isPositive
    ? "text-green-500"
    : isNegative
      ? "text-red-500"
      : "text-muted-foreground"

  // Risk / Reward
  const rr = calculateRiskReward(
    data.direction,
    entryPrice,
    data.stopLoss ?? null,
    data.takeProfit ?? null,
    data.instrument,
  )
  const riskDollars =
    rr.riskPips !== null ? computeDollarAmount(units, rr.riskPips, data.instrument) : null
  const rewardDollars =
    rr.rewardPips !== null ? computeDollarAmount(units, rr.rewardPips, data.instrument) : null

  // Left accent color
  const accentColor = isLong ? "border-l-green-500" : "border-l-red-500"

  return (
    <div
      className={cn(
        "border-border/60 bg-card overflow-hidden rounded-xl border border-l-[3px]",
        accentColor,
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={() => onToggleExpand()}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="hover:bg-muted/30 focus-visible:ring-ring w-full px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
            aria-expanded={isExpanded}
            aria-label={`${pair} ${data.direction} trade${isExpanded ? ", collapse details" : ", expand details"}`}
          >
            {/* Row 1: Pair + Direction + P/L */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold tracking-tight">{pair}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-0 px-1.5 py-0 text-[10px] font-semibold",
                      isLong ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500",
                    )}
                  >
                    {isLong ? "BUY" : "SELL"}
                  </Badge>
                  {isPending && (
                    <Badge
                      variant="outline"
                      className="border-amber-500/20 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-500"
                    >
                      {(data as PendingOrderData).orderType}
                    </Badge>
                  )}
                  {isClosed && (
                    <OutcomeBadge
                      outcome={(data as ClosedTradeData).outcome}
                      closeReason={(data as ClosedTradeData).closeReason}
                      closeContext={(data as ClosedTradeData).closeContext}
                    />
                  )}
                </div>

                {/* Subtitle: source + metrics */}
                <div className="text-muted-foreground mt-1 flex items-center gap-2 text-[11px]">
                  <SourceBadge source={data.source} />
                  {rr.ratio && <span>{rr.ratio} R:R</span>}
                  {isOpen && (
                    <DurationDisplay
                      openedAt={(data as OpenTradeData).openedAt}
                      className="inline text-[11px]"
                    />
                  )}
                  {isClosed && (
                    <DurationDisplay
                      openedAt={(data as ClosedTradeData).openedAt}
                      closedAt={(data as ClosedTradeData).closedAt}
                      className="inline text-[11px]"
                    />
                  )}
                </div>
              </div>

              {/* P/L — the hero element */}
              <div className="flex shrink-0 items-center gap-2">
                {(isOpen || isClosed) && (
                  <div className="text-right">
                    <div
                      className={cn(
                        "font-mono text-lg font-bold tabular-nums leading-tight",
                        plColor,
                      )}
                    >
                      {isPositive ? "+" : ""}
                      {isOpen ? (
                        <AnimatedNumber value={formatCurrency(plValue, currency)} />
                      ) : (
                        formatCurrency(plValue, currency)
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-[10px]">
                      {isOpen ? "unrealized P/L" : "final result"}
                    </div>
                  </div>
                )}
                {/* AI quick-access */}
                {onAiAnalysis && (
                  <div
                    role="button"
                    tabIndex={0}
                    className="hover:bg-muted flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAiAnalysis()
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        e.stopPropagation()
                        onAiAnalysis()
                      }
                    }}
                    aria-label="AI Analysis"
                  >
                    <Sparkles
                      className={cn(
                        "size-4",
                        activeAiProgress
                          ? "animate-pulse text-amber-500"
                          : latestAnalysis
                            ? "text-purple-500"
                            : "text-muted-foreground",
                      )}
                    />
                  </div>
                )}
                <ChevronDown
                  className={cn(
                    "text-muted-foreground size-4 shrink-0 transition-transform duration-200",
                    isExpanded && "rotate-180",
                  )}
                />
              </div>
            </div>

            {/* Row 2: Progress bar */}
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              {isPending && (
                <PendingProgressBar
                  instrument={data.instrument}
                  entryPrice={(data as PendingOrderData).entryPrice}
                  currentPrice={currentPriceProp ?? null}
                  stopLoss={data.stopLoss}
                  direction={data.direction}
                />
              )}
              {isOpen && (
                <OpenProgressBar
                  instrument={data.instrument}
                  direction={data.direction}
                  entryPrice={(data as OpenTradeData).entryPrice}
                  currentPrice={(data as OpenTradeData).currentPrice}
                  stopLoss={data.stopLoss ?? null}
                  takeProfit={data.takeProfit ?? null}
                />
              )}
              {isClosed && data.stopLoss && data.takeProfit && (
                <div className="text-muted-foreground flex items-center gap-3 text-[10px]">
                  <span className="text-red-500/70">Stop: {data.stopLoss.toFixed(decimals)}</span>
                  <span className="text-muted-foreground/40">→</span>
                  <span>Entry: {entryPrice.toFixed(decimals)}</span>
                  <span className="text-muted-foreground/40">→</span>
                  <span className="text-green-500/70">
                    Target: {data.takeProfit.toFixed(decimals)}
                  </span>
                </div>
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* ─── Expanded Content ─── */}
        <CollapsibleContent>
          <div className="border-border/40 space-y-4 border-t px-4 pb-4 pt-4">
            {/* Price cards — Entry / SL / TP */}
            <div className="grid grid-cols-3 gap-2">
              <PriceCard
                icon={<Target className="size-3.5" />}
                label="Entry"
                value={entryPrice.toFixed(decimals)}
                color="text-amber-500"
                sublabel={isLong ? "Bought here" : "Sold here"}
              />
              <PriceCard
                icon={<ShieldAlert className="size-3.5" />}
                label="Stop Loss"
                value={data.stopLoss ? data.stopLoss.toFixed(decimals) : "None"}
                color="text-red-500"
                sublabel="Limits your loss"
              />
              <PriceCard
                icon={<DollarSign className="size-3.5" />}
                label="Target"
                value={data.takeProfit ? data.takeProfit.toFixed(decimals) : "None"}
                color="text-green-500"
                sublabel="Locks in profit"
              />
            </div>

            {/* Current / Exit price */}
            {isOpen && (data as OpenTradeData).currentPrice && (
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg p-3",
                  isPositive ? "bg-green-500/5" : isNegative ? "bg-red-500/5" : "bg-muted/50",
                )}
              >
                <span className="text-muted-foreground text-xs">Price now</span>
                <span className={cn("font-mono text-base font-bold tabular-nums", plColor)}>
                  <AnimatedNumber
                    value={(data as OpenTradeData).currentPrice!.toFixed(decimals)}
                    className={plColor}
                  />
                </span>
              </div>
            )}
            {isClosed && (data as ClosedTradeData).exitPrice && (
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg p-3",
                  isPositive ? "bg-green-500/5" : isNegative ? "bg-red-500/5" : "bg-muted/50",
                )}
              >
                <span className="text-muted-foreground text-xs">Closed at</span>
                <span className={cn("font-mono text-base font-bold tabular-nums", plColor)}>
                  {(data as ClosedTradeData).exitPrice!.toFixed(decimals)}
                </span>
              </div>
            )}

            {/* Risk vs Reward bar */}
            {(riskDollars !== null || rewardDollars !== null) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground font-medium">Risk vs Reward</span>
                  {rr.ratio && <span className="text-muted-foreground font-mono">{rr.ratio}</span>}
                </div>
                <div className="flex h-6 gap-0.5 overflow-hidden rounded-lg">
                  {riskDollars !== null && (
                    <div
                      className="flex items-center justify-center rounded-l-lg bg-red-500/15 text-[10px] font-semibold text-red-500"
                      style={{
                        width:
                          rr.riskPips !== null && rr.rewardPips !== null
                            ? `${Math.max(25, Math.min(50, (rr.riskPips / (rr.riskPips + rr.rewardPips)) * 100))}%`
                            : "40%",
                      }}
                    >
                      -{fmtDollar(riskDollars)}
                    </div>
                  )}
                  {rewardDollars !== null && (
                    <div className="flex flex-1 items-center justify-center rounded-r-lg bg-green-500/15 text-[10px] font-semibold text-green-500">
                      +{fmtDollar(rewardDollars)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Key stats grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <StatRow label="Size" value={`${Math.abs(units).toLocaleString()} units`} />
              {rr.ratio && <StatRow label="Risk : Reward" value={rr.ratio} />}

              {(isOpen || isClosed) && (data as OpenTradeData).mfe !== null && (
                <StatRow
                  label="Best run"
                  value={
                    <span className="text-green-500">
                      +{formatPips((data as OpenTradeData).mfe!)}p
                    </span>
                  }
                />
              )}
              {(isOpen || isClosed) && (data as OpenTradeData).mae !== null && (
                <StatRow
                  label="Worst dip"
                  value={
                    <span className="text-red-500">
                      -{formatPips(Math.abs((data as OpenTradeData).mae!))}p
                    </span>
                  }
                />
              )}

              {(isOpen || isClosed) && (
                <StatRow
                  label="Fees"
                  value={formatCurrency((data as OpenTradeData).financing, currency)}
                />
              )}

              <StatRow
                label="Timeframe"
                value={
                  data.timeframe
                    ? (TIMEFRAME_OPTIONS.find((o) => o.value === data.timeframe)?.label ??
                      data.timeframe)
                    : "—"
                }
              />

              {isOpen && (
                <StatRow
                  label="Open for"
                  value={
                    <DurationDisplay
                      openedAt={(data as OpenTradeData).openedAt}
                      className="font-mono text-xs tabular-nums"
                    />
                  }
                />
              )}
              {isClosed && (
                <StatRow
                  label="Duration"
                  value={
                    <DurationDisplay
                      openedAt={(data as ClosedTradeData).openedAt}
                      closedAt={(data as ClosedTradeData).closedAt}
                      className="font-mono text-xs tabular-nums"
                    />
                  }
                />
              )}

              {isPending && (
                <StatRow
                  label="Created"
                  value={formatShortDateTime(new Date((data as PendingOrderData).createdAt))}
                />
              )}
              {isOpen && (
                <StatRow
                  label="Opened"
                  value={formatShortDateTime(new Date((data as OpenTradeData).openedAt))}
                />
              )}
              {isClosed && (
                <>
                  <StatRow
                    label="Opened"
                    value={formatShortDateTime(new Date((data as ClosedTradeData).openedAt))}
                  />
                  <StatRow
                    label="Closed"
                    value={formatShortDateTime(new Date((data as ClosedTradeData).closedAt))}
                  />
                </>
              )}
            </div>

            {/* Tags */}
            {(tags ?? data.tags).length > 0 && (
              <div className="flex items-center gap-2">
                <TagBadges tags={tags ?? data.tags} maxVisible={4} />
              </div>
            )}

            {/* AI Analysis inline */}
            {onAiAnalysis && (
              <div
                className="flex cursor-pointer items-center justify-between rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 transition-colors hover:bg-purple-500/10"
                onClick={(e) => {
                  e.stopPropagation()
                  onAiAnalysis()
                }}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-purple-500" />
                  <div>
                    <span className="text-xs font-medium">AI Analysis</span>
                    {latestAnalysis && (
                      <span className="text-muted-foreground ml-2 text-[10px]">
                        {analysisCount ?? 1} analysis{(analysisCount ?? 1) !== 1 ? "es" : ""}
                      </span>
                    )}
                    {activeAiProgress && (
                      <span className="ml-2 animate-pulse text-[10px] text-amber-500">
                        Running...
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown className="text-muted-foreground size-3.5 -rotate-90" />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2">
              {onViewDetails && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 gap-1.5 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    onViewDetails()
                  }}
                >
                  <Eye className="size-3.5" />
                  Full Details
                </Button>
              )}
              {isPending && onCancelOrder && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive border-destructive/30 h-8 gap-1.5 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCancelOrder()
                  }}
                >
                  <XCircle className="size-3.5" />
                  Cancel
                </Button>
              )}
              {isOpen && onCloseTrade && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive border-destructive/30 h-8 gap-1.5 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCloseTrade()
                  }}
                >
                  <XCircle className="size-3.5" />
                  Close Trade
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
