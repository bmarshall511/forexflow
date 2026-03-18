import { LineSeries, LineStyle } from "lightweight-charts"
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts"
import type { SeriesMarker } from "lightweight-charts"
import type { ReplayCandle, ReplayTradeInfo } from "@/app/api/trades/[tradeId]/replay-candles/route"
import type { OverlayVisibility } from "./replay-overlay-legend"

/** Shared options for all overlay line series (no markers, no price line) */
function baseLineOptions(color: string, style: number) {
  return {
    color,
    lineWidth: 1 as const,
    lineStyle: style,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
    pointMarkersVisible: false,
  }
}

export interface OverlayLines {
  entry: ISeriesApi<"Line">
  sl: ISeriesApi<"Line"> | null
  tp: ISeriesApi<"Line"> | null
  exit: ISeriesApi<"Line"> | null
}

/** Create all overlay line series on the chart */
export function createOverlayLines(chart: IChartApi, tradeInfo: ReplayTradeInfo): OverlayLines {
  const entry = chart.addSeries(LineSeries, baseLineOptions("#f59e0b", LineStyle.Dashed))

  const sl =
    tradeInfo.stopLoss !== null
      ? chart.addSeries(LineSeries, baseLineOptions("#ef4444", LineStyle.Dashed))
      : null

  const tp =
    tradeInfo.takeProfit !== null
      ? chart.addSeries(LineSeries, baseLineOptions("#22c55e", LineStyle.Dashed))
      : null

  const exit =
    tradeInfo.exitPrice !== null
      ? chart.addSeries(LineSeries, baseLineOptions("#a855f7", LineStyle.Solid))
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
 * Build entry/exit arrow markers to set on the candlestick series.
 * Returns markers sorted by time (required by lightweight-charts).
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
        text: `${isLong ? "BUY" : "SELL"} @ ${tradeInfo.entryPrice}`,
      })
    }
  }

  // Exit arrow
  if (exitCandleIdx >= 0 && currentIndex >= exitCandleIdx && tradeInfo.exitPrice !== null) {
    const candle = candles[exitCandleIdx]
    if (candle) {
      markers.push({
        time: candle.time as Time,
        position: isLong ? "aboveBar" : "belowBar",
        color: "#a855f7",
        shape: isLong ? "arrowDown" : "arrowUp",
        text: `EXIT @ ${tradeInfo.exitPrice}`,
      })
    }
  }

  return markers
}
