"use client"

import { useState, useMemo } from "react"
import type {
  PendingOrderData,
  OpenTradeData,
  ClosedTradeData,
  TradeCloseReason,
  CloseContext,
  TrendVisualSettings,
  ZoneData,
} from "@fxflow/types"
import { formatCurrency, formatPips, priceToPips, getDecimalPlaces } from "@fxflow/shared"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { SectionCard, DetailRow, MetricTile } from "@/components/ui/section-card"
import { DirectionBadge } from "./direction-badge"
import { SourceBadge } from "./source-badge"
import { TimeframeSelect } from "./timeframe-select"
import { TagEditor } from "./tag-editor"
import { NotesEditor } from "./notes-editor"
import { TradeEventsTimeline } from "./trade-events-timeline"
import { PartialCloseTimeline } from "./partial-close-timeline"
import { TradeStatusBanner } from "./trade-status-banner"
import { RiskRewardDisplay } from "./risk-reward-display"
import type { PositionPriceTick } from "@fxflow/types"
import { TradingViewChart } from "@/components/charts/tradingview-chart"
import { createEntryLevel, createExitLevel } from "@/components/charts/chart-markers"
import type { TradeLevel } from "@/components/charts/trade-level-primitive"
import { TradeEditorPanel } from "./trade-editor-panel"
import { AiAnalysisSheet } from "@/components/ai/ai-analysis-sheet"
import { TradeReplayDialog } from "@/components/analytics/trade-replay-dialog"
import { useTradeDetail } from "@/hooks/use-trade-detail"
import { useAiAnalysis } from "@/hooks/use-ai-analysis"
import { useTradeFinderSetup } from "@/hooks/use-trade-finder-setup"
import { useTags } from "@/hooks/use-tags"
import { ChartOverlayToggles } from "./chart-overlay-toggles"
import type { OverlayVisibility } from "./chart-overlay-toggles"
import { SetupAnalysisSection } from "./setup-analysis-section"
import { DurationDisplay } from "./duration-display"
import { cn } from "@/lib/utils"
import {
  BarChart3,
  TrendingUp,
  ClipboardList,
  Tag,
  FileText,
  Sparkles,
  Shield,
  Info,
  Scissors,
  PlayCircle,
  Ban,
} from "lucide-react"

/** Map cancelledBy values to user-friendly descriptions */
const CANCEL_DESCRIPTIONS: Record<string, string> = {
  trade_finder:
    "The Trade Finder scanner detected that the supply/demand zone this order was based on became invalid (price broke through the zone boundary), so the order was automatically cancelled.",
  user: "You cancelled this order manually.",
  user_bulk: "This order was cancelled as part of a bulk cancel action.",
  ai_condition: "An AI condition triggered the cancellation of this order.",
  system:
    "This order was no longer found on OANDA during a routine sync. It may have been cancelled directly on the broker platform, expired, or rejected.",
  expired: "This order expired before the market reached the entry price.",
}

function CancellationCallout({ closeContext }: { closeContext?: CloseContext | null }) {
  const cancelledBy = closeContext?.cancelledBy
  const reason = closeContext?.cancelReason
  const description = cancelledBy ? (CANCEL_DESCRIPTIONS[cancelledBy] ?? null) : null

  return (
    <div className="border-border/50 bg-muted/30 flex gap-3 rounded-lg border px-3.5 py-3">
      <Ban className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium">Why was this order cancelled?</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {description ?? reason ?? "No cancellation details are available for this order."}
        </p>
        {description && reason && reason !== description && (
          <p className="text-muted-foreground/80 text-[11px] italic">{reason}</p>
        )}
        {closeContext?.cancelledAt && (
          <p className="text-muted-foreground/60 text-[10px]">
            {new Date(closeContext.cancelledAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  )
}

export type TradeUnion =
  | (PendingOrderData & { _type: "pending" })
  | (OpenTradeData & { _type: "open" })
  | (ClosedTradeData & { _type: "closed" })

interface TradeDetailDrawerProps {
  trade: TradeUnion | null
  open: boolean
  onOpenChange: (open: boolean) => void
  currency?: string
  /** Live market price for pending orders (passed from parent table) */
  currentPrice?: number | null
  /** Full price tick for real-time candle updates */
  lastTick?: PositionPriceTick | null
  onCancelOrder?: () => void
  onCloseTrade?: () => void
  /** Called after a tag is assigned or removed so the parent can refresh its batch tag state */
  onTagMutated?: () => void
}

export function TradeDetailDrawer({
  trade,
  open,
  onOpenChange,
  currency = "USD",
  currentPrice: externalCurrentPrice,
  lastTick,
  onCancelOrder,
  onCloseTrade,
  onTagMutated,
}: TradeDetailDrawerProps) {
  const tradeId = trade?.id ?? null
  const [aiSheetOpen, setAiSheetOpen] = useState(false)
  const [replayOpen, setReplayOpen] = useState(false)
  const { detail, updateNotes, updateTimeframe, assignTag, removeTag, refetch } =
    useTradeDetail(tradeId)
  const { history: aiHistory } = useAiAnalysis(tradeId)
  const { tags: allTags, createTag } = useTags()

  // Trade Finder setup lookup (only fetches for TF trades)
  const oandaSourceId = trade
    ? trade._type === "pending"
      ? trade.sourceOrderId
      : trade.sourceTradeId
    : null
  const {
    setup: tfSetup,
    isTradeFinderTrade,
    isLoading: tfSetupLoading,
  } = useTradeFinderSetup(oandaSourceId, trade?.source)

  // Chart overlay toggles (only relevant when setup data exists)
  const [overlayVis, setOverlayVis] = useState<OverlayVisibility>({
    showZones: true,
    showTrend: true,
    showCurve: true,
  })

  // Compute trade entry/exit levels for chart (must be before early return)
  const tradeTimeframe = detail?.timeframe ?? trade?.timeframe ?? "H1"
  const tradeLevels = useMemo((): TradeLevel[] => {
    if (!trade) return []
    const tf = tradeTimeframe
    const decimals = getDecimalPlaces(trade.instrument)
    if (trade._type === "open") {
      return [createEntryLevel(trade.openedAt, trade.direction, trade.entryPrice, tf, decimals)]
    }
    if (trade._type === "closed") {
      return [
        createEntryLevel(trade.openedAt, trade.direction, trade.entryPrice, tf, decimals),
        createExitLevel(
          trade.closedAt,
          trade.direction,
          trade.closeReason as TradeCloseReason,
          trade.exitPrice ?? trade.entryPrice,
          tf,
          decimals,
        ),
      ]
    }
    return []
  }, [trade, tradeTimeframe])

  const scrollToTime = useMemo(() => {
    if (!trade) return undefined
    if (trade._type === "open") return Math.floor(new Date(trade.openedAt).getTime() / 1000)
    if (trade._type === "closed") return Math.floor(new Date(trade.openedAt).getTime() / 1000)
    return undefined
  }, [trade])

  // Derive chart overlay data from the Trade Finder setup snapshot
  const setupZones = useMemo((): ZoneData[] | undefined => {
    if (!tfSetup || !overlayVis.showZones) return undefined
    return [tfSetup.zone]
  }, [tfSetup, overlayVis.showZones])

  const setupTrendVisuals = useMemo(
    (): TrendVisualSettings => ({
      showBoxes: true,
      showLines: true,
      showMarkers: true,
      showLabels: true,
      showControllingSwing: true,
      boxOpacity: 0.1,
    }),
    [],
  )

  const setupTrendData = overlayVis.showTrend ? (tfSetup?.trendData ?? null) : null
  const setupCurveData = overlayVis.showCurve ? (tfSetup?.curveData ?? null) : null
  const setupZonePrice = trade
    ? trade._type === "open" && trade.currentPrice != null
      ? trade.currentPrice
      : trade.entryPrice
    : null

  if (!trade) return null

  const pair = trade.instrument.replace("_", "/")
  const decimals = getDecimalPlaces(trade.instrument)

  // Live price: from open trade data or external prop (pending orders)
  const livePrice = trade._type === "open" ? trade.currentPrice : (externalCurrentPrice ?? null)

  // Compute performance metrics
  const tradeUnits =
    trade._type === "pending"
      ? trade.units
      : trade._type === "open"
        ? trade.currentUnits
        : (trade as ClosedTradeData).units

  const potGain =
    trade.takeProfit !== null
      ? Math.abs(
          trade.direction === "long"
            ? trade.takeProfit - trade.entryPrice
            : trade.entryPrice - trade.takeProfit,
        ) * tradeUnits
      : null

  const potLoss =
    trade.stopLoss !== null
      ? -(
          Math.abs(
            trade.direction === "long"
              ? trade.entryPrice - trade.stopLoss
              : trade.stopLoss - trade.entryPrice,
          ) * tradeUnits
        )
      : null

  const handleAssignTag = async (tagId: string) => {
    await assignTag(tagId)
    onTagMutated?.()
  }

  const handleRemoveTag = async (tagId: string) => {
    await removeTag(tagId)
    onTagMutated?.()
  }

  const handleCreateAndAssignTag = async (name: string, color: string) => {
    const tag = await createTag(name, color)
    if (tag) {
      await assignTag(tag.id)
      onTagMutated?.()
    }
    return tag
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-lg">
          {/* Header */}
          <SheetHeader className="border-border/50 shrink-0 border-b px-5 pb-3 pt-5">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-xl font-bold">{pair}</SheetTitle>
              <DirectionBadge direction={trade.direction} />
              <SourceBadge source={trade.source} />
            </div>
            <SheetDescription className="text-muted-foreground text-xs">
              {trade._type === "pending" && `${trade.orderType.replace("_", " ")} Order`}
              {trade._type === "open" && "Open Trade"}
              {trade._type === "closed" && "Closed Trade"}
              {trade._type !== "pending" && (
                <>
                  {" "}
                  &middot; Opened{" "}
                  {new Date(trade.openedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </>
              )}
              {trade._type === "closed" && (
                <>
                  {" "}
                  &middot; Closed{" "}
                  {new Date(trade.closedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </>
              )}
            </SheetDescription>
          </SheetHeader>

          {/* Scrollable body */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {/* Status Banner */}
            <TradeStatusBanner
              status={trade._type}
              orderType={trade._type === "pending" ? trade.orderType : undefined}
              openedAt={trade._type !== "pending" ? trade.openedAt : undefined}
              closedAt={trade._type === "closed" ? trade.closedAt : undefined}
              outcome={trade._type === "closed" ? trade.outcome : undefined}
              closeReason={trade._type === "closed" ? trade.closeReason : undefined}
              closeContext={trade._type === "closed" ? trade.closeContext : undefined}
            />

            {/* Cancellation explanation callout */}
            {trade._type === "closed" && trade.outcome === "cancelled" && (
              <CancellationCallout closeContext={trade.closeContext} />
            )}

            {/* Chart with price overlays */}
            <SectionCard
              icon={BarChart3}
              title="Chart"
              helper={
                trade._type !== "closed"
                  ? "Drag the SL/TP lines on the chart to adjust them. Changes are saved automatically."
                  : "A chart of this trade from entry to exit."
              }
            >
              {trade._type === "open" || trade._type === "pending" ? (
                <TradeEditorPanel
                  trade={trade}
                  defaultTimeframe={detail?.timeframe}
                  currency={currency}
                  onAction={trade._type === "open" ? onCloseTrade : onCancelOrder}
                  currentPrice={trade._type === "pending" ? livePrice : undefined}
                  lastTick={lastTick}
                  onSaved={refetch}
                  tradeLevels={tradeLevels}
                  scrollToTime={scrollToTime}
                  zones={setupZones}
                  zoneCurrentPrice={setupZonePrice}
                  curveData={setupCurveData}
                  trendData={setupTrendData}
                  trendVisuals={setupTrendVisuals}
                />
              ) : (
                <TradingViewChart
                  instrument={trade.instrument}
                  direction={trade.direction}
                  entryPrice={trade.entryPrice}
                  currentPrice={livePrice}
                  lastTick={lastTick}
                  stopLoss={trade.stopLoss}
                  takeProfit={trade.takeProfit}
                  exitPrice={trade.exitPrice}
                  defaultTimeframe={detail?.timeframe}
                  tradeLevels={tradeLevels}
                  scrollToTime={scrollToTime}
                  zones={setupZones}
                  zoneCurrentPrice={setupZonePrice}
                  curveData={setupCurveData}
                  trendData={setupTrendData}
                  trendVisuals={setupTrendVisuals}
                  height={260}
                />
              )}
              {/* Overlay toggles for Trade Finder trades */}
              {isTradeFinderTrade && tfSetup && (
                <ChartOverlayToggles
                  visibility={overlayVis}
                  onChange={setOverlayVis}
                  hasTrend={tfSetup.trendData != null}
                  hasCurve={tfSetup.curveData != null}
                  className="pt-1"
                />
              )}
              {isTradeFinderTrade && tfSetupLoading && (
                <p className="text-muted-foreground/60 px-1 pt-1 text-[10px]">
                  Loading setup analysis…
                </p>
              )}
              {isTradeFinderTrade && !tfSetupLoading && !tfSetup && (
                <p className="text-muted-foreground/60 px-1 pt-1 text-[10px]">
                  Setup analysis data no longer available (may have been cleaned up).
                </p>
              )}
            </SectionCard>

            {/* Trade Details */}
            <SectionCard
              icon={Info}
              title="Trade Details"
              helper="The basic setup of your trade — what you're trading and how."
            >
              <div>
                <DetailRow label="Pair" value={pair} />
                <DetailRow
                  label="Direction"
                  value={<DirectionBadge direction={trade.direction} />}
                />
                {trade._type === "pending" && (
                  <DetailRow label="Order Type" value={trade.orderType.replace("_", " ")} />
                )}
                <DetailRow label="Entry Price" value={trade.entryPrice.toFixed(decimals)} />
                {trade._type === "closed" && (trade as ClosedTradeData).exitPrice !== null && (
                  <DetailRow
                    label="Exit Price"
                    value={(trade as ClosedTradeData).exitPrice!.toFixed(decimals)}
                  />
                )}
                <DetailRow
                  label="Units"
                  value={
                    trade._type === "open" && trade.currentUnits !== trade.initialUnits
                      ? `${trade.currentUnits} / ${trade.initialUnits}`
                      : tradeUnits.toLocaleString()
                  }
                />
                <DetailRow
                  label="Timeframe"
                  value={
                    <TimeframeSelect
                      value={detail?.timeframe ?? trade.timeframe}
                      onChange={async (tf) => {
                        await updateTimeframe(tf)
                      }}
                    />
                  }
                />
                {trade._type === "pending" && (
                  <>
                    <DetailRow label="Time in Force" value={trade.timeInForce} />
                    {trade.timeInForce === "GTD" && trade.gtdTime && (
                      <DetailRow
                        label="Expires"
                        value={new Date(trade.gtdTime).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      />
                    )}
                  </>
                )}
              </div>
            </SectionCard>

            {/* Protection (SL, TP, R:R) */}
            <SectionCard
              icon={Shield}
              title="Protection"
              helper="Stop Loss limits your loss if the market moves against you. Take Profit locks in your gains automatically."
            >
              <div>
                <DetailRow
                  label="Stop Loss"
                  value={trade.stopLoss !== null ? trade.stopLoss.toFixed(decimals) : "Not set"}
                  className={trade.stopLoss === null ? "text-muted-foreground" : undefined}
                />
                {trade.stopLoss !== null && (
                  <DetailRow
                    label="SL Distance"
                    value={
                      formatPips(
                        priceToPips(trade.instrument, Math.abs(trade.entryPrice - trade.stopLoss)),
                      ) + " pips"
                    }
                    className="text-muted-foreground"
                  />
                )}
                <DetailRow
                  label="Take Profit"
                  value={trade.takeProfit !== null ? trade.takeProfit.toFixed(decimals) : "Not set"}
                  className={trade.takeProfit === null ? "text-muted-foreground" : undefined}
                />
                {trade.takeProfit !== null && (
                  <DetailRow
                    label="TP Distance"
                    value={
                      formatPips(
                        priceToPips(
                          trade.instrument,
                          Math.abs(trade.takeProfit - trade.entryPrice),
                        ),
                      ) + " pips"
                    }
                    className="text-muted-foreground"
                  />
                )}
                {trade._type !== "closed" &&
                  trade.trailingStopDistance !== null &&
                  trade.trailingStopDistance > 0 && (
                    <DetailRow label="Trailing Stop" value={`${trade.trailingStopDistance} pips`} />
                  )}
                <DetailRow
                  label="Risk : Reward"
                  value={
                    <RiskRewardDisplay
                      direction={trade.direction}
                      entryPrice={trade.entryPrice}
                      stopLoss={trade.stopLoss}
                      takeProfit={trade.takeProfit}
                      instrument={trade.instrument}
                      compact
                    />
                  }
                />
              </div>
            </SectionCard>

            {/* Setup Analysis (Trade Finder trades only) */}
            {tfSetup && <SetupAnalysisSection setup={tfSetup} />}

            {/* Performance */}
            <SectionCard
              icon={TrendingUp}
              title="Performance"
              helper="How your trade is performing right now. Green means profit, red means loss."
            >
              <div className="grid grid-cols-2 gap-2">
                {/* Pending: Current price + distance to fill */}
                {trade._type === "pending" && livePrice !== null && (
                  <>
                    <MetricTile
                      label="Current Price"
                      value={<AnimatedNumber value={livePrice.toFixed(decimals)} />}
                    />
                    <MetricTile
                      label="Distance to Fill"
                      value={
                        formatPips(
                          priceToPips(trade.instrument, Math.abs(livePrice - trade.entryPrice)),
                        ) + " pips"
                      }
                    />
                  </>
                )}

                {/* Open: Live P/L, current price, duration */}
                {trade._type === "open" && (
                  <>
                    <MetricTile
                      label="Unrealized P/L"
                      value={
                        <AnimatedNumber
                          value={formatCurrency(trade.unrealizedPL, currency)}
                          className={cn(
                            "font-semibold",
                            trade.unrealizedPL >= 0
                              ? "text-status-connected"
                              : "text-status-disconnected",
                          )}
                        />
                      }
                      large
                    />
                    {trade.currentPrice !== null && (
                      <MetricTile
                        label="Current Price"
                        value={<AnimatedNumber value={trade.currentPrice.toFixed(decimals)} />}
                      />
                    )}
                    <MetricTile
                      label="Duration"
                      value={
                        <DurationDisplay
                          openedAt={trade.openedAt}
                          className="font-mono text-sm tabular-nums"
                        />
                      }
                    />
                  </>
                )}

                {/* Closed: Final P/L, duration */}
                {trade._type === "closed" && (
                  <>
                    <MetricTile
                      label="Realized P/L"
                      value={formatCurrency(trade.realizedPL, currency)}
                      className={cn(
                        "font-semibold",
                        trade.realizedPL >= 0
                          ? "text-status-connected"
                          : "text-status-disconnected",
                      )}
                      large
                    />
                    <MetricTile
                      label="Duration"
                      value={
                        <DurationDisplay
                          openedAt={trade.openedAt}
                          closedAt={trade.closedAt}
                          className="font-mono text-sm tabular-nums"
                        />
                      }
                    />
                    {trade.outcome !== "cancelled" && (
                      <MetricTile
                        label="Close Reason"
                        value={trade.closeReason?.replace(/_/g, " ") ?? "—"}
                      />
                    )}
                  </>
                )}

                {/* MFE/MAE — shown for open and closed */}
                {trade._type !== "pending" && (
                  <>
                    <MetricTile
                      label="Best (MFE)"
                      value={trade.mfe !== null ? formatPips(trade.mfe) + " pips" : "—"}
                      className={trade.mfe !== null ? "text-status-connected" : undefined}
                    />
                    <MetricTile
                      label="Worst (MAE)"
                      value={trade.mae !== null ? formatPips(Math.abs(trade.mae)) + " pips" : "—"}
                      className={trade.mae !== null ? "text-status-disconnected" : undefined}
                    />
                  </>
                )}

                {/* Potential Gain/Loss — all states */}
                {potGain !== null && (
                  <MetricTile
                    label="Potential Gain"
                    value={formatCurrency(potGain, currency)}
                    className="text-status-connected"
                  />
                )}
                {potLoss !== null && (
                  <MetricTile
                    label="Potential Loss"
                    value={formatCurrency(potLoss, currency)}
                    className="text-status-disconnected"
                  />
                )}

                {/* Financing — open and closed */}
                {trade._type !== "pending" && trade.financing !== 0 && (
                  <MetricTile
                    label="Financing"
                    value={formatCurrency(trade.financing, currency)}
                    className={
                      trade.financing >= 0 ? "text-status-connected" : "text-status-disconnected"
                    }
                  />
                )}

                {/* Margin — open trades */}
                {trade._type === "open" && trade.marginUsed > 0 && (
                  <MetricTile
                    label="Margin Used"
                    value={formatCurrency(trade.marginUsed, currency)}
                  />
                )}
              </div>
            </SectionCard>

            {/* Tags */}
            <SectionCard
              icon={Tag}
              title="Tags"
              helper="Organize your trades with colored labels — use them to track strategies, setups, or categories."
            >
              <TagEditor
                assignedTags={detail?.tags ?? []}
                allTags={allTags}
                onAssign={handleAssignTag}
                onRemove={handleRemoveTag}
                onCreate={handleCreateAndAssignTag}
              />
            </SectionCard>

            {/* Notes */}
            <SectionCard
              icon={FileText}
              title="Notes"
              helper="Add personal notes about your reasoning, setup, or lessons learned."
            >
              <NotesEditor initialNotes={detail?.notes ?? ""} onSave={updateNotes} />
            </SectionCard>

            {/* Events Timeline */}
            {detail?.events && detail.events.length > 0 && (
              <SectionCard
                icon={ClipboardList}
                title="Events"
                helper="A timeline of everything that happened with this trade."
              >
                <TradeEventsTimeline events={detail.events} />
              </SectionCard>
            )}

            {/* Partial Close Timeline */}
            {detail?.events &&
              detail.events.some((e) => e.eventType === "PARTIAL_CLOSE") &&
              trade._type !== "pending" && (
                <SectionCard
                  icon={Scissors}
                  title="Scale-Out History"
                  helper="How the position was reduced over time through partial closes."
                >
                  <PartialCloseTimeline
                    events={detail.events}
                    originalUnits={
                      trade._type === "open" ? trade.initialUnits : (trade as ClosedTradeData).units
                    }
                    instrument={trade.instrument}
                    entryTime={trade.openedAt}
                    currency={currency}
                  />
                </SectionCard>
              )}
          </div>

          {/* Footer — action buttons */}
          <div className="border-border/50 flex shrink-0 items-center gap-2 border-t p-4">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setAiSheetOpen(true)}
            >
              <Sparkles className="size-3" />
              AI Analysis
              {aiHistory.length > 0 && (
                <span className="bg-primary/10 text-primary ml-0.5 rounded-full px-1.5 text-[9px]">
                  {aiHistory.length}
                </span>
              )}
            </Button>

            {trade._type === "closed" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setReplayOpen(true)}
              >
                <PlayCircle className="size-3" />
                Replay Trade
              </Button>
            )}

            <div className="flex-1" />

            {trade._type === "pending" && onCancelOrder && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive gap-1.5 text-xs"
                onClick={onCancelOrder}
              >
                Cancel Order
              </Button>
            )}
            {trade._type === "open" && onCloseTrade && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive gap-1.5 text-xs"
                onClick={onCloseTrade}
              >
                Close Trade
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* AI Analysis Sheet */}
      <AiAnalysisSheet
        trade={trade}
        tradeStatus={trade._type}
        open={aiSheetOpen}
        onOpenChange={setAiSheetOpen}
      />

      {/* Trade Replay Dialog */}
      {trade._type === "closed" && (
        <TradeReplayDialog
          tradeId={tradeId}
          open={replayOpen}
          onOpenChange={setReplayOpen}
          tfSetup={tfSetup}
        />
      )}
    </>
  )
}
