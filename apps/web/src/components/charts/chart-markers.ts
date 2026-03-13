import type { IChartApi, Time } from "lightweight-charts"
import type { TradeCloseReason, TradeDirection } from "@fxflow/types"
import { TIMEFRAME_SECONDS } from "./chart-utils"
import type { TradeLevel } from "./trade-level-primitive"

/**
 * Snap a raw Unix-seconds timestamp to the start of its candle period.
 * E.g. for H1, a trade at 14:23:47 (1705328627) → 14:00:00 (1705327200).
 * This prevents markers from jumping to newer candles.
 */
export function snapToCandle(rawSeconds: number, timeframe: string): Time {
  const period = TIMEFRAME_SECONDS[timeframe] ?? 3600
  return (Math.floor(rawSeconds / period) * period) as Time
}

/** Convert ISO timestamp → snapped candle time */
function toSnappedTime(isoTimestamp: string, timeframe: string): Time {
  const raw = Math.floor(new Date(isoTimestamp).getTime() / 1000)
  return snapToCandle(raw, timeframe)
}

/** Close reason → label + color */
function getExitConfig(closeReason: TradeCloseReason): { label: string; color: string } {
  switch (closeReason) {
    case "STOP_LOSS_ORDER":
      return { label: "SL Hit", color: "#ef4444" }
    case "TAKE_PROFIT_ORDER":
      return { label: "TP Hit", color: "#22c55e" }
    case "TRAILING_STOP_LOSS_ORDER":
      return { label: "TSL Hit", color: "#f97316" }
    case "MARKET_ORDER":
    case "LINKED_TRADE_CLOSED":
    case "REVERSAL":
      return { label: "Closed", color: "#a855f7" }
    case "MARGIN_CLOSEOUT":
      return { label: "Margin", color: "#ef4444" }
    default:
      return { label: "Closed", color: "#6b7280" }
  }
}

/** Create a trade-level indicator for a trade entry */
export function createEntryLevel(
  openedAt: string,
  direction: TradeDirection,
  entryPrice: number,
  timeframe: string,
  decimals: number,
): TradeLevel {
  return {
    time: toSnappedTime(openedAt, timeframe),
    price: entryPrice,
    label: "Entry",
    color: direction === "long" ? "#22c55e" : "#ef4444",
    decimals,
  }
}

/** Create a trade-level indicator for a trade exit */
export function createExitLevel(
  closedAt: string,
  direction: TradeDirection,
  closeReason: TradeCloseReason,
  exitPrice: number,
  timeframe: string,
  decimals: number,
): TradeLevel {
  const { label, color } = getExitConfig(closeReason)
  return {
    time: toSnappedTime(closedAt, timeframe),
    price: exitPrice,
    label,
    color,
    decimals,
  }
}

/**
 * Scroll the chart to center on a specific time.
 * Shows ~30 candles before and ~20 after the target.
 * Falls back to fitContent() if the range is invalid.
 */
export function scrollToEntry(
  chart: IChartApi,
  targetTime: number,
  timeframe: string,
): void {
  const interval = TIMEFRAME_SECONDS[timeframe] ?? 3600
  const from = (targetTime - interval * 30) as Time
  const to = (targetTime + interval * 20) as Time

  try {
    chart.timeScale().setVisibleRange({ from, to })
  } catch {
    chart.timeScale().fitContent()
  }
}
