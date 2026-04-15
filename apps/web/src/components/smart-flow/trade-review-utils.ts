/**
 * Pure formatting + data-shaping helpers for the Trade Review drawer.
 *
 * Kept runtime-free (no React, no fetches) so the larger component files
 * stay under the 150-LOC rule and the helpers can be unit-tested in
 * isolation later if we decide we want that.
 *
 * @module smart-flow/trade-review-utils
 */

import type {
  SmartFlowTradeData,
  SmartFlowManagementEntry,
  SmartFlowPartialCloseEntry,
  SmartFlowAiSuggestion,
} from "@fxflow/types"

export const PRESET_LABELS: Record<string, string> = {
  momentum_catch: "Momentum Catch",
  steady_growth: "Steady Growth",
  swing_capture: "Swing Capture",
  trend_rider: "Trend Rider",
  recovery: "Recovery Mode",
  custom: "Custom",
}

export const SAFETY_NET_LABELS: Record<string, string> = {
  max_drawdown: "Max loss protection",
  max_hold: "Time limit reached",
  max_financing: "Fee limit reached",
  margin_warning: "Margin warning",
}

export const REGIME_LABELS: Record<string, string> = {
  trending: "Trending",
  ranging: "Ranging",
  volatile: "Volatile",
  low_volatility: "Low volatility",
}

export type TimelineEvent =
  | {
      kind: "management"
      at: string
      action: string
      source: SmartFlowManagementEntry["source"]
      detail: string
    }
  | { kind: "partial"; at: string; percent: number; pips: number; pnl: number }
  | {
      kind: "ai"
      at: string
      action: string
      confidence: number
      rationale: string
      autoExecuted: boolean
    }

/**
 * Merge-sort the three event streams (management log, partial close log,
 * AI suggestions) into one chronological timeline.
 */
export function buildTimeline(trade: SmartFlowTradeData): TimelineEvent[] {
  const events: TimelineEvent[] = []
  for (const e of trade.managementLog) {
    events.push({
      kind: "management",
      at: e.at,
      action: e.action,
      source: e.source,
      detail: e.detail,
    })
  }
  for (const p of trade.partialCloseLog as SmartFlowPartialCloseEntry[]) {
    const at = (p as unknown as { at?: string }).at ?? trade.createdAt
    events.push({ kind: "partial", at, percent: p.percent, pips: p.pips, pnl: p.pnl })
  }
  for (const s of trade.aiSuggestions as SmartFlowAiSuggestion[]) {
    events.push({
      kind: "ai",
      at: s.at,
      action: s.action,
      confidence: s.confidence,
      rationale: s.rationale,
      autoExecuted: s.autoExecuted ?? false,
    })
  }
  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  return events
}

export function formatDurationMs(ms: number): string {
  if (ms <= 0) return "—"
  const hours = ms / 3_600_000
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${Math.round(hours / 24)}d`
}

export function formatMoney(value: number | null | undefined): string {
  if (value == null) return "—"
  const sign = value >= 0 ? "+" : ""
  return `${sign}$${value.toFixed(2)}`
}

export function formatPips(value: number | null | undefined): string {
  if (value == null) return "—"
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(1)} pips`
}

export function formatPrice(
  value: number | null | undefined,
  instrument: string | undefined,
): string {
  if (value == null) return "—"
  const digits = instrument?.includes("JPY") ? 3 : 5
  return value.toFixed(digits)
}

export function formatTimeShort(at: string): string {
  try {
    return new Date(at).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return at
  }
}

export function humaniseAction(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatCloseReason(raw: string | null | undefined): string {
  if (!raw) return "—"
  // OANDA returns upper-snake like "TAKE_PROFIT_ORDER", "STOP_LOSS_ORDER".
  const map: Record<string, string> = {
    TAKE_PROFIT_ORDER: "Take profit hit",
    STOP_LOSS_ORDER: "Stop loss hit",
    TRAILING_STOP_LOSS_ORDER: "Trailing stop hit",
    MARKET_ORDER: "Manual market close",
  }
  return map[raw] ?? humaniseAction(raw.toLowerCase())
}
