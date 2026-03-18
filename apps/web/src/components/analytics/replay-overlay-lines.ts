import { LineSeries, LineStyle } from "lightweight-charts"
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts"
import type { SeriesMarker } from "lightweight-charts"
import type { ReplayCandle, ReplayTradeInfo } from "@/app/api/trades/[tradeId]/replay-candles/route"
import type { OverlayVisibility } from "./replay-overlay-legend"
import { getPipSize } from "@fxflow/shared"

/** Shared options for all overlay line series */
function baseLineOptions(color: string, style: number, label: string) {
  return {
    color,
    lineWidth: 1 as const,
    lineStyle: style,
    lastValueVisible: true, // Show price label on the right axis
    priceLineVisible: false,
    crosshairMarkerVisible: false,
    pointMarkersVisible: false,
    title: label, // Label shown on the price axis
  }
}

export interface OverlayLines {
  entry: ISeriesApi<"Line">
  sl: ISeriesApi<"Line"> | null
  tp: ISeriesApi<"Line"> | null
  exit: ISeriesApi<"Line"> | null
}

/** Create all overlay line series on the chart with price labels */
export function createOverlayLines(chart: IChartApi, tradeInfo: ReplayTradeInfo): OverlayLines {
  const entry = chart.addSeries(LineSeries, baseLineOptions("#f59e0b", LineStyle.Dashed, "Entry"))

  const sl =
    tradeInfo.stopLoss !== null
      ? chart.addSeries(LineSeries, baseLineOptions("#ef4444", LineStyle.Dashed, "Safety Exit"))
      : null

  const tp =
    tradeInfo.takeProfit !== null
      ? chart.addSeries(LineSeries, baseLineOptions("#22c55e", LineStyle.Dashed, "Target"))
      : null

  const exit =
    tradeInfo.exitPrice !== null
      ? chart.addSeries(LineSeries, baseLineOptions("#a855f7", LineStyle.Solid, "Exit"))
      : null

  return { entry, sl, tp, exit }
}

/** Update overlay line data based on current playback index, respecting visibility toggles */
export function updateOverlayLines(
  lines: OverlayLines,
  candles: ReplayCandle[],
  tradeInfo: ReplayTradeInfo,
  currentIndex: number,
  entryCandleIdx: number,
  exitCandleIdx: number,
  visibility?: OverlayVisibility,
): void {
  const vis: OverlayVisibility = visibility ?? {
    entry: true,
    stopLoss: true,
    takeProfit: true,
    exit: true,
    zones: true,
  }

  const slice = (fromIdx: number) => candles.slice(fromIdx, currentIndex + 1)
  const entryVisible = entryCandleIdx >= 0 && currentIndex >= entryCandleIdx

  // Entry line
  if (entryVisible && vis.entry) {
    lines.entry.setData(
      slice(entryCandleIdx).map((c) => ({ time: c.time as Time, value: tradeInfo.entryPrice })),
    )
  } else {
    lines.entry.setData([])
  }

  // SL line
  if (lines.sl && tradeInfo.stopLoss !== null && entryVisible && vis.stopLoss) {
    lines.sl.setData(
      slice(entryCandleIdx).map((c) => ({ time: c.time as Time, value: tradeInfo.stopLoss! })),
    )
  } else if (lines.sl) {
    lines.sl.setData([])
  }

  // TP line
  if (lines.tp && tradeInfo.takeProfit !== null && entryVisible && vis.takeProfit) {
    lines.tp.setData(
      slice(entryCandleIdx).map((c) => ({ time: c.time as Time, value: tradeInfo.takeProfit! })),
    )
  } else if (lines.tp) {
    lines.tp.setData([])
  }

  // Exit line
  if (
    lines.exit &&
    tradeInfo.exitPrice !== null &&
    exitCandleIdx >= 0 &&
    currentIndex >= exitCandleIdx &&
    vis.exit
  ) {
    lines.exit.setData(
      slice(exitCandleIdx).map((c) => ({ time: c.time as Time, value: tradeInfo.exitPrice! })),
    )
  } else if (lines.exit) {
    lines.exit.setData([])
  }
}

/**
 * Build entry/exit arrow markers for the candlestick series.
 * Uses plain English labels. Includes close reason context on exit marker.
 */
export function getReplayMarkers(
  candles: ReplayCandle[],
  tradeInfo: ReplayTradeInfo,
  currentIndex: number,
  entryCandleIdx: number,
  exitCandleIdx: number,
): SeriesMarker<Time>[] {
  const markers: SeriesMarker<Time>[] = []
  const isLong = tradeInfo.direction === "long"

  // Entry arrow
  if (entryCandleIdx >= 0 && currentIndex >= entryCandleIdx) {
    const candle = candles[entryCandleIdx]
    if (candle) {
      markers.push({
        time: candle.time as Time,
        position: isLong ? "belowBar" : "aboveBar",
        color: "#f59e0b",
        shape: isLong ? "arrowUp" : "arrowDown",
        text: isLong ? "BOUGHT HERE" : "SOLD HERE",
      })
    }
  }

  // Exit arrow with close reason context
  if (exitCandleIdx >= 0 && currentIndex >= exitCandleIdx && tradeInfo.exitPrice !== null) {
    const candle = candles[exitCandleIdx]
    if (candle) {
      const exitLabel = getExitLabel(tradeInfo)
      markers.push({
        time: candle.time as Time,
        position: isLong ? "aboveBar" : "belowBar",
        color: tradeInfo.realizedPL >= 0 ? "#22c55e" : "#ef4444",
        shape: isLong ? "arrowDown" : "arrowUp",
        text: exitLabel,
      })
    }
  }

  return markers
}

/** Get a plain English exit label based on close reason */
function getExitLabel(trade: ReplayTradeInfo): string {
  const pl = trade.realizedPL
  const plStr = pl >= 0 ? `+$${pl.toFixed(2)}` : `-$${Math.abs(pl).toFixed(2)}`

  switch (trade.closeReason) {
    case "STOP_LOSS_ORDER":
      return `Safety exit hit (${plStr})`
    case "TAKE_PROFIT_ORDER":
      return `Target reached! (${plStr})`
    case "TRAILING_STOP_LOSS_ORDER":
      return `Trailing stop hit (${plStr})`
    case "MARKET_ORDER":
      return `Closed manually (${plStr})`
    case "MARKET_ORDER_TRADE_CLOSE":
      return `Closed (${plStr})`
    default:
      return `Closed (${plStr})`
  }
}
