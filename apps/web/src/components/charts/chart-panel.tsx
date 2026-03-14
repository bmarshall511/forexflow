"use client"

import { memo, useCallback, useMemo, useRef, useState } from "react"
import { ArrowUp, ArrowDown, Eye, EyeOff, Layers } from "lucide-react"
import type { SeriesMarker, Time } from "lightweight-charts"
import type {
  ChartPanelConfig,
  PositionPriceTick,
  TradeCloseReason,
  TradeDirection,
  ZoneData,
} from "@fxflow/types"
import { TIMEFRAME_OPTIONS, getDecimalPlaces } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import type { TradeUnion } from "@/components/positions/trade-editor-panel"
import type { LineType } from "@/hooks/use-price-line-drag"
import { useChartSignals } from "@/hooks/use-chart-signals"
import { useZones } from "@/hooks/use-zones"
import { useZoneSettings } from "@/hooks/use-zone-settings"
import { useTrends } from "@/hooks/use-trends"
import { useTrendSettings } from "@/hooks/use-trend-settings"
import { ZoneControlsPopover } from "./zone-controls-popover"
import { ZoneSummaryBar } from "./zone-summary-bar"
import { TrendSummaryBar } from "./trend-summary-bar"
import { ZoneDetailSheet } from "./zone-detail-sheet"
import { DraggableTradeChart } from "./draggable-trade-chart"
import { TradingViewChart } from "./tradingview-chart"
import { InstrumentSelector } from "./instrument-selector"
import { StandaloneChart } from "./standalone-chart"
import type { OrderOverlayConfig } from "./standalone-chart"
import { OrderEntryOverlay } from "./order-entry-overlay"
import { createEntryLevel, createExitLevel } from "./chart-markers"
import type { TradeLevel } from "./trade-level-primitive"

/** Props bundle for trade chart overlay — passed from page-level editor */
export interface TradeChartConfig {
  trade: TradeUnion
  currentPrice: number | null
  draftSL: number | null
  draftTP: number | null
  onDraftChange: (lineType: LineType, price: number) => void
}

interface ChartPanelProps {
  config: ChartPanelConfig
  onConfigChange: (config: Partial<ChartPanelConfig>) => void
  lastTick: PositionPriceTick | null
  loadDelay?: number
  isActive?: boolean
  onActivate?: () => void
  /** Trade overlay config — only set on the active panel when a trade is selected */
  tradeChart?: TradeChartConfig | null
  /** Called when the user changes instrument on a panel with a trade — clears the trade */
  onClearTrade?: () => void
  /** Show buy/sell overlay buttons on this panel */
  showOrderOverlay?: boolean
  /** Called when the user clicks Buy or Sell on the overlay */
  onOrderEntry?: (direction: TradeDirection) => void
  /** Order price lines overlay for StandaloneChart */
  orderOverlay?: OrderOverlayConfig | null
  className?: string
}

function ChartPanelInner({
  config,
  onConfigChange,
  lastTick,
  loadDelay,
  isActive,
  onActivate,
  tradeChart,
  onClearTrade,
  showOrderOverlay,
  onOrderEntry,
  orderOverlay,
  className,
}: ChartPanelProps) {
  const [showSignals, setShowSignals] = useState(true)
  const hasTrade = tradeChart != null
  const displayInstrument = hasTrade ? tradeChart.trade.instrument : config.instrument
  // Effective timeframe: trade's saved timeframe (if any) or panel config timeframe
  const effectiveTimeframe = hasTrade
    ? (tradeChart.trade.timeframe ?? config.timeframe)
    : config.timeframe
  const { markers: signalMarkers } = useChartSignals(
    displayInstrument,
    showSignals,
    effectiveTimeframe,
  )

  // ─── Zone detection ──────────────────────────────────────────────────
  const {
    settings: zoneSettings,
    globalSettings,
    saveGlobal,
    overrides: zoneOverrides,
    setOverrides: setZoneOverrides,
  } = useZoneSettings(config.zoneOverrides)

  // Track chart candle count — zones re-fetch when chart loads more candles
  const [chartCandleCount, setChartCandleCount] = useState(0)
  const handleCandleCountChange = useCallback((count: number) => {
    setChartCandleCount(count)
  }, [])

  // Derive current mid-price from last tick
  const zoneMidPrice = useMemo(() => {
    if (!lastTick || lastTick.instrument !== displayInstrument) return null
    return (lastTick.bid + lastTick.ask) / 2
  }, [lastTick, displayInstrument])

  const {
    zones,
    higherTfZones,
    nearestDemand,
    nearestSupply,
    curveAlignment,
    isComputing: zonesComputing,
    lastComputedAt: zonesComputedAt,
    curveData,
    recompute: zonesRecompute,
  } = useZones({
    instrument: displayInstrument,
    timeframe: effectiveTimeframe,
    enabled: zoneSettings.enabled,
    currentPrice: zoneMidPrice,
    settings: zoneSettings,
    chartCandleCount,
  })

  // ─── Trend detection ────────────────────────────────────────────────────
  const {
    settings: trendSettings,
    globalSettings: trendGlobalSettings,
    saveGlobal: saveTrendGlobal,
    overrides: trendOverrides,
    setOverrides: setTrendOverrides,
  } = useTrendSettings(config.trendOverrides)

  const {
    trendData,
    higherTfTrendData,
    isComputing: trendComputing,
    lastComputedAt: trendComputedAt,
    recompute: trendRecompute,
  } = useTrends({
    instrument: displayInstrument,
    timeframe: effectiveTimeframe,
    enabled: trendSettings.enabled,
    currentPrice: zoneMidPrice,
    settings: trendSettings,
    chartCandleCount,
  })

  // ─── Zone click → detail sheet ──────────────────────────────────────────
  const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null)
  const [zoneSheetOpen, setZoneSheetOpen] = useState(false)

  const handleZoneClick = useCallback((zone: ZoneData) => {
    setSelectedZone(zone)
    setZoneSheetOpen(true)
  }, [])

  // Compute trade entry/exit levels (drawn by TradeLevelPrimitive on the candles)
  const tradeLevels = useMemo((): TradeLevel[] => {
    if (!hasTrade) return []
    const trade = tradeChart.trade
    const tf = trade.timeframe ?? config.timeframe
    const decimals = getDecimalPlaces(trade.instrument)
    const result: TradeLevel[] = []

    if (trade._type === "open") {
      result.push(createEntryLevel(trade.openedAt, trade.direction, trade.entryPrice, tf, decimals))
    } else if (trade._type === "closed") {
      result.push(createEntryLevel(trade.openedAt, trade.direction, trade.entryPrice, tf, decimals))
      result.push(
        createExitLevel(
          trade.closedAt,
          trade.direction,
          trade.closeReason as TradeCloseReason,
          trade.exitPrice ?? trade.entryPrice,
          tf,
          decimals,
        ),
      )
    }
    // Pending orders: no candle indicators
    return result
  }, [hasTrade, tradeChart, config.timeframe])

  // Signal markers only (trade levels are drawn separately by the primitive)
  const chartMarkers = useMemo((): SeriesMarker<Time>[] => {
    if (!showSignals) return []
    return [...signalMarkers].sort((a, b) => (a.time as number) - (b.time as number))
  }, [showSignals, signalMarkers])

  // Compute scroll target (entry candle time) for auto-scroll
  const scrollToTime = useMemo((): number | undefined => {
    if (!hasTrade) return undefined
    const trade = tradeChart.trade
    if (trade._type === "open") return Math.floor(new Date(trade.openedAt).getTime() / 1000)
    if (trade._type === "closed") return Math.floor(new Date(trade.openedAt).getTime() / 1000)
    return undefined // pending: no entry candle
  }, [hasTrade, tradeChart])

  const priceBadge = useMemo(() => {
    if (!lastTick || lastTick.instrument !== displayInstrument) return null
    return { bid: lastTick.bid, ask: lastTick.ask }
  }, [lastTick, displayInstrument])

  // Keep last known bid/ask to prevent "--" flash during price updates
  const lastBidAskRef = useRef<{ bid: number; ask: number } | null>(null)
  const prevInstrumentRef = useRef(displayInstrument)
  if (prevInstrumentRef.current !== displayInstrument) {
    lastBidAskRef.current = null
    prevInstrumentRef.current = displayInstrument
  }
  if (priceBadge) lastBidAskRef.current = priceBadge
  const displayBidAsk = priceBadge ?? lastBidAskRef.current

  const priceDecimals = displayInstrument.includes("JPY") ? 3 : 5
  const priceMinW = displayInstrument.includes("JPY") ? "min-w-[5ch]" : "min-w-[7ch]"

  return (
    <div
      className={cn("bg-background group relative flex flex-col overflow-hidden", className)}
      onClick={onActivate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onActivate?.()
      }}
      aria-label={`Chart panel ${config.instrument}`}
      aria-pressed={isActive}
    >
      {/* Active indicator — top accent bar (direction-colored when trade assigned) */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-10 h-0.5 transition-all duration-200",
          hasTrade
            ? tradeChart.trade.direction === "long"
              ? "bg-green-500 opacity-100"
              : "bg-red-500 opacity-100"
            : isActive
              ? "bg-primary opacity-100"
              : "bg-primary opacity-0 group-hover:opacity-20",
        )}
      />
      {/* Chart toolbar — always visible; changing instrument clears any trade overlay */}
      <div className="flex min-h-[32px] shrink-0 items-center gap-1 border-b px-1.5 py-1">
        <InstrumentSelector
          value={hasTrade ? tradeChart.trade.instrument : config.instrument}
          onChange={(instrument) => {
            onConfigChange({ instrument })
            if (hasTrade) onClearTrade?.()
          }}
        />
        {hasTrade && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
              tradeChart.trade.direction === "long"
                ? "bg-green-500/15 text-green-500"
                : "bg-red-500/15 text-red-500",
            )}
          >
            {tradeChart.trade.direction === "long" ? (
              <ArrowUp className="h-2.5 w-2.5" />
            ) : (
              <ArrowDown className="h-2.5 w-2.5" />
            )}
            {tradeChart.trade.direction === "long" ? "Long" : "Short"}
          </span>
        )}
        {!hasTrade && (
          <select
            value={config.timeframe}
            onChange={(e) => {
              e.stopPropagation()
              onConfigChange({ timeframe: e.target.value })
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Timeframe"
            className="hover:bg-muted focus:bg-muted ml-1 min-w-[3rem] cursor-pointer appearance-none rounded border-0 bg-transparent px-1 py-0.5 text-center font-mono text-xs outline-none"
          >
            {TIMEFRAME_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setShowSignals((v) => !v)
          }}
          className={cn(
            "ml-1 rounded p-0.5 transition-colors",
            showSignals
              ? "text-primary hover:text-primary/80"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-label={showSignals ? "Hide signal markers" : "Show signal markers"}
          aria-pressed={showSignals}
          title={showSignals ? "Hide signals" : "Show signals"}
        >
          {showSignals ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
        <ZoneControlsPopover
          settings={zoneSettings}
          overrides={zoneOverrides}
          onSaveGlobal={saveGlobal}
          onSetOverrides={setZoneOverrides}
          isComputing={zonesComputing}
          lastComputedAt={zonesComputedAt}
          onRecompute={zonesRecompute}
          chartTimeframe={effectiveTimeframe}
          trendSettings={trendSettings}
          trendOverrides={trendOverrides}
          onSaveTrendGlobal={saveTrendGlobal}
          onSetTrendOverrides={setTrendOverrides}
          trendComputing={trendComputing}
          trendLastComputedAt={trendComputedAt}
          onTrendRecompute={trendRecompute}
        >
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "ml-0.5 rounded p-0.5 transition-colors",
              zoneSettings.enabled || trendSettings.enabled
                ? "text-emerald-500 hover:text-emerald-400"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-label="Overlay settings"
            title="Overlays (Zones & Trends)"
          >
            <Layers className="h-3.5 w-3.5" />
          </button>
        </ZoneControlsPopover>
        <div className="ml-auto shrink-0">
          {displayBidAsk ? (
            <div className="flex items-center gap-1 font-mono text-[10px] tabular-nums">
              <span className="text-muted-foreground/60 text-[8px] uppercase">Bid</span>
              <span className={cn("text-right text-red-500", priceMinW)}>
                {displayBidAsk.bid.toFixed(priceDecimals)}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground/60 text-[8px] uppercase">Ask</span>
              <span className={cn("text-right text-green-500", priceMinW)}>
                {displayBidAsk.ask.toFixed(priceDecimals)}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground text-[10px]">--</span>
          )}
        </div>
      </div>

      {/* Chart area — fills all available space */}
      <div className="relative min-h-0 flex-1">
        {hasTrade ? (
          tradeChart.trade._type === "closed" ? (
            <TradingViewChart
              instrument={tradeChart.trade.instrument}
              direction={tradeChart.trade.direction}
              entryPrice={tradeChart.trade.entryPrice}
              stopLoss={tradeChart.trade.stopLoss}
              takeProfit={tradeChart.trade.takeProfit}
              exitPrice={tradeChart.trade.exitPrice}
              currentPrice={tradeChart.currentPrice}
              lastTick={lastTick}
              defaultTimeframe={tradeChart.trade.timeframe}
              markers={chartMarkers}
              tradeLevels={tradeLevels}
              scrollToTime={scrollToTime}
              zones={zoneSettings.enabled ? zones : undefined}
              higherTfZones={zoneSettings.enabled ? higherTfZones : undefined}
              zoneCurrentPrice={zoneMidPrice}
              curveData={curveData}
              trendData={trendSettings.enabled ? trendData : undefined}
              higherTfTrendData={trendSettings.enabled ? higherTfTrendData : undefined}
              trendVisuals={trendSettings.enabled ? trendSettings.visuals : undefined}
              onZoneClick={handleZoneClick}
              className="h-full"
            />
          ) : (
            <DraggableTradeChart
              instrument={tradeChart.trade.instrument}
              direction={tradeChart.trade.direction}
              entryPrice={tradeChart.trade.entryPrice}
              currentPrice={tradeChart.currentPrice}
              lastTick={lastTick}
              draftSL={tradeChart.draftSL}
              draftTP={tradeChart.draftTP}
              savedSL={tradeChart.trade.stopLoss}
              savedTP={tradeChart.trade.takeProfit}
              defaultTimeframe={tradeChart.trade.timeframe}
              onDraftChange={tradeChart.onDraftChange}
              markers={chartMarkers}
              tradeLevels={tradeLevels}
              scrollToTime={scrollToTime}
              zones={zoneSettings.enabled ? zones : undefined}
              higherTfZones={zoneSettings.enabled ? higherTfZones : undefined}
              zoneCurrentPrice={zoneMidPrice}
              curveData={curveData}
              trendData={trendSettings.enabled ? trendData : undefined}
              higherTfTrendData={trendSettings.enabled ? higherTfTrendData : undefined}
              trendVisuals={trendSettings.enabled ? trendSettings.visuals : undefined}
              onZoneClick={handleZoneClick}
              className="h-full"
            />
          )
        ) : (
          <StandaloneChart
            instrument={config.instrument}
            timeframe={config.timeframe}
            lastTick={lastTick}
            loadDelay={loadDelay}
            orderOverlay={orderOverlay}
            markers={chartMarkers}
            zones={zoneSettings.enabled ? zones : undefined}
            higherTfZones={zoneSettings.enabled ? higherTfZones : undefined}
            currentPrice={zoneMidPrice}
            curveData={curveData}
            trendData={trendSettings.enabled ? trendData : undefined}
            higherTfTrendData={trendSettings.enabled ? higherTfTrendData : undefined}
            trendVisuals={trendSettings.enabled ? trendSettings.visuals : undefined}
            onZoneClick={handleZoneClick}
            onCandleCountChange={handleCandleCountChange}
          />
        )}
        {/* Buy/Sell overlay — shown on active standalone panels without a trade */}
        {showOrderOverlay && !hasTrade && onOrderEntry && (
          <OrderEntryOverlay
            bid={displayBidAsk?.bid ?? null}
            ask={displayBidAsk?.ask ?? null}
            instrument={config.instrument}
            onBuy={() => onOrderEntry("long")}
            onSell={() => onOrderEntry("short")}
          />
        )}
      </div>

      {/* Zone summary bar — shown below chart when zones are enabled */}
      {zoneSettings.enabled && (nearestDemand || nearestSupply) && (
        <ZoneSummaryBar
          nearestDemand={nearestDemand}
          nearestSupply={nearestSupply}
          curveAlignment={curveAlignment}
          curvePosition={curveData?.position ?? null}
          currentPrice={zoneMidPrice}
          isComputing={zonesComputing}
          onZoneClick={handleZoneClick}
          className="mx-1.5 mb-1"
        />
      )}

      {/* Trend summary bar — shown below chart when trend is enabled */}
      {trendSettings.enabled && trendData && (
        <TrendSummaryBar
          trendData={trendData}
          higherTfTrendData={higherTfTrendData}
          isComputing={trendComputing}
          className="mx-1.5 mb-1"
        />
      )}

      {/* Zone detail sheet — opens when a zone is clicked */}
      <ZoneDetailSheet zone={selectedZone} open={zoneSheetOpen} onOpenChange={setZoneSheetOpen} />
    </div>
  )
}

export const ChartPanel = memo(ChartPanelInner)
