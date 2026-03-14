import { LineSeries, LineStyle } from "lightweight-charts"
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts"
import type { ReplayCandle, ReplayTradeInfo } from "@/app/api/trades/[tradeId]/replay-candles/route"

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

/** Update overlay line data based on current playback index */
export function updateOverlayLines(
  lines: OverlayLines,
  candles: ReplayCandle[],
  tradeInfo: ReplayTradeInfo,
  currentIndex: number,
  entryCandleIdx: number,
  exitCandleIdx: number,
): void {
  const slice = (fromIdx: number) => candles.slice(fromIdx, currentIndex + 1)

  const entryVisible = entryCandleIdx >= 0 && currentIndex >= entryCandleIdx

  // Entry line
  if (entryVisible) {
    lines.entry.setData(
      slice(entryCandleIdx).map((c) => ({ time: c.time as Time, value: tradeInfo.entryPrice })),
    )
  } else {
    lines.entry.setData([])
  }

  // SL line
  if (lines.sl && tradeInfo.stopLoss !== null && entryVisible) {
    lines.sl.setData(
      slice(entryCandleIdx).map((c) => ({ time: c.time as Time, value: tradeInfo.stopLoss! })),
    )
  } else if (lines.sl) {
    lines.sl.setData([])
  }

  // TP line
  if (lines.tp && tradeInfo.takeProfit !== null && entryVisible) {
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
    currentIndex >= exitCandleIdx
  ) {
    lines.exit.setData(
      slice(exitCandleIdx).map((c) => ({ time: c.time as Time, value: tradeInfo.exitPrice! })),
    )
  } else if (lines.exit) {
    lines.exit.setData([])
  }
}
