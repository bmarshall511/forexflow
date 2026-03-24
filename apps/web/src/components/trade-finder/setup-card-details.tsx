"use client"

import { useState } from "react"
import type { TradeFinderSetupData, TrendVisualSettings } from "@fxflow/types"
import { TIMEFRAME_SET_MAP } from "@fxflow/types"
import { formatInstrument, formatRelativeTime, getPipSize } from "@fxflow/shared"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronRight, Target, ShieldAlert, DollarSign, CheckCircle2, Zap } from "lucide-react"
import { PriceCard, StatRow } from "@/components/ui/price-card"
import { SetupScoreBreakdown } from "./setup-score-breakdown"
import { StandaloneChart } from "@/components/charts/standalone-chart"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { PlaceOrderDialog } from "./place-order-dialog"
import { useLivePrice } from "@/hooks/use-live-price"
import { cn } from "@/lib/utils"
import {
  TF_LABELS,
  fmtDollar,
  computeDollarAmount,
  STATUS_STYLES,
  getAutoTradeStatus,
} from "./setup-card-utils"
import type { AutoTradeConfig } from "./setup-card-utils"

const DEFAULT_TREND_VISUALS: TrendVisualSettings = {
  showBoxes: true,
  showLines: true,
  showMarkers: true,
  showLabels: true,
  showControllingSwing: true,
  boxOpacity: 0.15,
}

interface SetupDetailSheetProps {
  setup: TradeFinderSetupData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPlace?: (setupId: string, orderType: "MARKET" | "LIMIT") => void
  autoTradeConfig?: AutoTradeConfig
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground whitespace-nowrap text-[10px] font-medium uppercase tracking-wider">
        {children}
      </span>
      <div className="bg-border h-px flex-1" />
    </div>
  )
}

export function SetupDetailSheet({
  setup,
  open,
  onOpenChange,
  onPlace,
  autoTradeConfig,
}: SetupDetailSheetProps) {
  if (!setup) {
    return (
      <Sheet open={false} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:w-[520px] sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Setup Details</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:w-[520px] sm:max-w-xl"
        showCloseButton
      >
        <SetupDetailContent setup={setup} onPlace={onPlace} autoTradeConfig={autoTradeConfig} />
      </SheetContent>
    </Sheet>
  )
}

function SetupDetailContent({
  setup,
  onPlace,
  autoTradeConfig,
}: {
  setup: TradeFinderSetupData
  onPlace?: (setupId: string, orderType: "MARKET" | "LIMIT") => void
  autoTradeConfig?: AutoTradeConfig
}) {
  const isLong = setup.direction === "long"
  const riskDollars = computeDollarAmount(setup.positionSize, setup.riskPips, setup.instrument)
  const rewardDollars = computeDollarAmount(setup.positionSize, setup.rewardPips, setup.instrument)
  const scorePct = Math.round((setup.scores.total / setup.scores.maxPossible) * 100)
  const scoreColor =
    scorePct >= 75 ? "text-green-500" : scorePct >= 58 ? "text-amber-500" : "text-orange-500"

  const { bid: livePrice } = useLivePrice(setup.instrument)
  const pipSize = getPipSize(setup.instrument)
  const liveDistancePips = livePrice
    ? Math.abs(livePrice - setup.entryPrice) / pipSize
    : setup.distanceToEntryPips

  // Chart state
  const [showOrder, setShowOrder] = useState(true)
  const [showZone, setShowZone] = useState(true)
  const [showTrend, setShowTrend] = useState(true)
  const [showCurve, setShowCurve] = useState(true)
  const [chartTfKey, setChartTfKey] = useState<"ltf" | "mtf" | "htf">("ltf")

  // Place order dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    orderType: "MARKET" | "LIMIT"
  }>({ open: false, orderType: "LIMIT" })
  const [isPlacing, setIsPlacing] = useState(false)

  const tfSet = TIMEFRAME_SET_MAP[setup.timeframeSet]
  const chartTimeframe = tfSet?.[chartTfKey] ?? tfSet?.ltf ?? "M15"

  const orderOverlay = showOrder
    ? {
        direction: setup.direction,
        orderType: "LIMIT" as const,
        entryPrice: setup.entryPrice,
        stopLoss: setup.stopLoss,
        takeProfit: setup.takeProfit,
        onDraftChange: () => {},
      }
    : null

  const canPlace = (setup.status === "active" || setup.status === "approaching") && !!onPlace

  const statusLabel = (() => {
    if (setup.autoPlaced && setup.status === "filled") return "Auto Filled"
    if (setup.autoPlaced && setup.status === "placed") return "Auto Pending"
    return STATUS_STYLES[setup.status]?.label ?? setup.status
  })()

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
      {/* ─── Sheet Header ─── */}
      <SheetHeader className="border-b px-5 py-4">
        <div className="flex items-start justify-between gap-3 pr-6">
          <div className="min-w-0 space-y-1">
            <SheetTitle className="flex items-center gap-2 text-xl">
              {formatInstrument(setup.instrument)}
              {setup.autoPlaced && (setup.status === "placed" || setup.status === "filled") && (
                <Zap className="size-4 text-teal-500" />
              )}
            </SheetTitle>
            <SheetDescription className="flex items-center gap-1.5 text-sm">
              <span className={cn(isLong ? "text-green-500" : "text-red-500", "font-semibold")}>
                {isLong ? "Buy" : "Sell"}
              </span>
              <span className="text-muted-foreground/40">&middot;</span>
              {livePrice && (
                <>
                  <span className="font-mono tabular-nums">
                    {livePrice.toFixed(setup.instrument.includes("JPY") ? 3 : 5)}
                  </span>
                  <span className="text-muted-foreground/40">&middot;</span>
                  <span className="text-muted-foreground">
                    {liveDistancePips < 1 ? "at entry" : `${liveDistancePips.toFixed(1)}p away`}
                  </span>
                  <span className="text-muted-foreground/40">&middot;</span>
                </>
              )}
              <span
                className={cn(
                  setup.status === "approaching" && "text-amber-500",
                  setup.status === "placed" && "text-teal-500",
                  setup.status === "filled" && "text-green-500",
                  setup.status === "invalidated" && "text-red-500",
                  setup.status === "active" && "text-blue-500",
                )}
              >
                {statusLabel}
              </span>
              <span className="text-muted-foreground/40">&middot;</span>
              <span className={cn("font-mono font-semibold", scoreColor)}>
                {setup.scores.total}/{setup.scores.maxPossible}
              </span>
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      {/* ─── Scrollable Body ─── */}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {/* Management status flags */}
        {(setup.breakevenMoved || setup.partialTaken) && (
          <div className="space-y-1.5">
            {setup.breakevenMoved && (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Safety net moved — can&apos;t lose on this trade</span>
              </div>
            )}
            {setup.partialTaken && (
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Some profit locked in</span>
              </div>
            )}
          </div>
        )}

        {/* Auto-trade status */}
        {autoTradeStatus?.reason && (
          <div
            className={cn(
              "rounded-lg border p-3 text-xs leading-snug",
              autoTradeStatus.type === "blocked"
                ? "border-amber-500/20 bg-amber-500/5 text-amber-500"
                : "border-blue-500/20 bg-blue-500/5 text-blue-400",
            )}
          >
            {autoTradeStatus.reason}
          </div>
        )}

        {/* ── RISK & REWARD ── */}
        <div className="space-y-2.5">
          <SectionLabel>Risk &amp; Reward</SectionLabel>
          <div className="flex h-8 gap-0.5 overflow-hidden rounded-lg">
            <div
              className="flex items-center justify-center rounded-l-lg bg-red-500/15 text-xs font-semibold text-red-500"
              style={{
                width: `${Math.max(25, Math.min(50, (1 / (1 + parseFloat(setup.rrRatio))) * 100))}%`,
              }}
            >
              -{fmtDollar(riskDollars)}
            </div>
            <div className="flex flex-1 items-center justify-center rounded-r-lg bg-green-500/15 text-xs font-semibold text-green-500">
              +{fmtDollar(rewardDollars)}
            </div>
          </div>
          <div className="text-muted-foreground flex justify-between text-[11px]">
            <span>Could lose {setup.riskPips.toFixed(1)} pips</span>
            <span>Could gain {setup.rewardPips.toFixed(1)} pips</span>
          </div>
        </div>

        {/* ── PRICE LEVELS ── */}
        <div className="space-y-2.5">
          <SectionLabel>Price Levels</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            <PriceCard
              icon={<Target className="size-3.5" />}
              label="Entry"
              sublabel={isLong ? "Buy here" : "Sell here"}
              value={setup.entryPrice.toFixed(5)}
              color="text-amber-500"
            />
            <PriceCard
              icon={<ShieldAlert className="size-3.5" />}
              label="Stop"
              sublabel={`-${fmtDollar(riskDollars)}`}
              value={setup.stopLoss.toFixed(5)}
              color="text-red-500"
            />
            <PriceCard
              icon={<DollarSign className="size-3.5" />}
              label="Target"
              sublabel={`+${fmtDollar(rewardDollars)}`}
              value={setup.takeProfit.toFixed(5)}
              color="text-green-500"
            />
          </div>
        </div>

        {/* ── TRADE INFO ── */}
        <div className="space-y-2.5">
          <SectionLabel>Trade Info</SectionLabel>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <StatRow label="Size" value={`${setup.positionSize.toLocaleString()} units`} />
            <StatRow label="Risk:Reward" value={setup.rrRatio} />
            <StatRow label="Zone" value={setup.zone.formation.replace(/_/g, " ")} />
            <StatRow label="Distance" value={`${liveDistancePips.toFixed(1)} pips`} />
            <StatRow
              label="Timeframe"
              value={TF_LABELS[setup.timeframeSet] ?? setup.timeframeSet}
            />
            {setup.placedAt && (
              <StatRow label="Placed" value={formatRelativeTime(setup.placedAt)} />
            )}
          </div>
        </div>

        {/* ── MARKET CONTEXT ── */}
        {(setup.trendData || setup.curveData) && (
          <div className="space-y-2.5">
            <SectionLabel>Market Context</SectionLabel>
            <div className="space-y-2">
              {setup.trendData && (
                <div className="flex items-center gap-2.5 text-xs">
                  <div
                    className={cn(
                      "size-2.5 rounded-full",
                      setup.trendData.direction === "up"
                        ? "bg-green-500"
                        : setup.trendData.direction === "down"
                          ? "bg-red-500"
                          : "bg-zinc-400",
                    )}
                  />
                  <span>
                    Trend going{" "}
                    <span className="font-medium">
                      {setup.trendData.direction === "up"
                        ? "up"
                        : setup.trendData.direction === "down"
                          ? "down"
                          : "sideways"}
                    </span>{" "}
                    <span className="text-muted-foreground">({setup.trendData.status})</span>
                  </span>
                </div>
              )}
              {setup.curveData && (
                <div className="flex items-center gap-2.5 text-xs">
                  <div
                    className={cn(
                      "size-2.5 rounded-full",
                      setup.curveData.position === "low" || setup.curveData.position === "below"
                        ? "bg-green-500"
                        : setup.curveData.position === "high" ||
                            setup.curveData.position === "above"
                          ? "bg-red-500"
                          : "bg-amber-500",
                    )}
                  />
                  <span>
                    Price in the <span className="font-medium">{setup.curveData.position}</span>{" "}
                    zone
                    <span className="text-muted-foreground">
                      {" "}
                      (
                      {setup.curveData.position === "low" || setup.curveData.position === "below"
                        ? "favorable"
                        : setup.curveData.position === "high" ||
                            setup.curveData.position === "above"
                          ? "unfavorable"
                          : "neutral"}
                      )
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CHART ── */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Chart</SectionLabel>
            {tfSet && (
              <div className="flex shrink-0 items-center gap-0.5 rounded-md border p-0.5">
                {(["ltf", "mtf", "htf"] as const).map((key) => {
                  const tf = tfSet[key]
                  const label = key === "ltf" ? "Entry" : key === "mtf" ? "Trend" : "Big Picture"
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setChartTfKey(key)}
                      className={cn(
                        "min-h-[28px] min-w-[36px] rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                        chartTfKey === key
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      title={`${label} timeframe (${tf})`}
                    >
                      {tf}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Chart overlay toggles */}
          <div className="flex flex-wrap gap-1.5">
            <OverlayToggle
              label="Entry/SL/TP"
              on={showOrder}
              onToggle={() => setShowOrder(!showOrder)}
              color="blue"
            />
            <OverlayToggle
              label="Zone"
              on={showZone}
              onToggle={() => setShowZone(!showZone)}
              color="purple"
            />
            {setup.trendData && (
              <OverlayToggle
                label="Trend"
                on={showTrend}
                onToggle={() => setShowTrend(!showTrend)}
                color="teal"
              />
            )}
            {setup.curveData && (
              <OverlayToggle
                label="Big Picture"
                on={showCurve}
                onToggle={() => setShowCurve(!showCurve)}
                color="amber"
              />
            )}
          </div>

          <div className="bg-background h-[300px] overflow-hidden rounded-lg border">
            <StandaloneChart
              key={`${setup.instrument}-${chartTimeframe}`}
              instrument={setup.instrument}
              timeframe={chartTimeframe}
              lastTick={null}
              orderOverlay={orderOverlay}
              zones={showZone ? [setup.zone] : []}
              currentPrice={livePrice ?? setup.entryPrice}
              curveData={showCurve ? setup.curveData : null}
              trendData={showTrend ? setup.trendData : null}
              trendVisuals={showTrend && setup.trendData ? DEFAULT_TREND_VISUALS : undefined}
            />
          </div>
        </div>

        {/* ── Score Breakdown (collapsible) ── */}
        <Collapsible>
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex min-h-[44px] items-center gap-1.5 text-xs transition-colors">
            <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
            <span>Why this score? (tap to see breakdown)</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <SetupScoreBreakdown scores={setup.scores} />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* ─── Sheet Footer: Action buttons ─── */}
      {canPlace && (
        <SheetFooter className="border-t px-5 py-4">
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button
              variant="default"
              size="default"
              className="h-11 flex-1 gap-1.5 text-sm font-medium"
              onClick={() => handlePlaceClick("LIMIT")}
            >
              Place Limit Order
            </Button>
            <Button
              variant="outline"
              size="default"
              className="h-11 gap-1.5 text-sm font-medium sm:flex-1"
              onClick={() => handlePlaceClick("MARKET")}
            >
              Market Order
            </Button>
          </div>
        </SheetFooter>
      )}

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

const OVERLAY_COLORS: Record<string, { on: string; off: string }> = {
  blue: {
    on: "border-blue-500/30 bg-blue-500/10 text-blue-500",
    off: "border-border text-muted-foreground",
  },
  purple: {
    on: "border-purple-500/30 bg-purple-500/10 text-purple-500",
    off: "border-border text-muted-foreground",
  },
  teal: {
    on: "border-teal-500/30 bg-teal-500/10 text-teal-500",
    off: "border-border text-muted-foreground",
  },
  amber: {
    on: "border-amber-500/30 bg-amber-500/10 text-amber-500",
    off: "border-border text-muted-foreground",
  },
}

function OverlayToggle({
  label,
  on,
  onToggle,
  color,
}: {
  label: string
  on: boolean
  onToggle: () => void
  color: string
}) {
  const colors = OVERLAY_COLORS[color] ?? OVERLAY_COLORS.blue!
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "min-h-[32px] rounded-full border px-3 py-1 text-[10px] font-medium transition-colors",
        on ? colors.on : colors.off,
      )}
    >
      {label}
    </button>
  )
}
