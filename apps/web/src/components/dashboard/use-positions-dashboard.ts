"use client"

import { useMemo, useRef } from "react"
import { usePositions } from "@/hooks/use-positions"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import type {
  OpenTradeData,
  PendingOrderData,
  ClosedTradeData,
  PositionsSummary,
} from "@fxflow/types"
import { priceToPips, calculateDistanceInfo } from "@fxflow/shared"

// ─── Proximity thresholds (hysteresis to prevent flickering) ────────────────

const PROXIMITY_ENTER = 70 // percent — threshold to appear in the list
const PROXIMITY_EXIT = 55 // percent — threshold to leave the list

// ─── Derived types ──────────────────────────────────────────────────────────

export interface ProximityTrade {
  trade: OpenTradeData
  progressPercent: number
  proximityType: "sl" | "tp"
  /** 0–100: higher = closer to the boundary */
  proximityPercent: number
}

export interface ProximityOrder {
  order: PendingOrderData
  fillPercent: number
  currentPrice: number
}

export interface PositionsDashboardData {
  summary: PositionsSummary
  totalExposure: number
  currency: string
  tradesNearClosing: ProximityTrade[]
  ordersNearFilling: ProximityOrder[]
  bestPerformer: OpenTradeData | null
  worstPerformer: OpenTradeData | null
  todayWins: number
  todayLosses: number
  todayNetPL: number
  todayWinRate: string
  recentClosed: ClosedTradeData[]
  isLoaded: boolean
  isConfigured: boolean
  hasError: boolean
  errorMessage: string | null
  openWithPrices: OpenTradeData[]
  pricesByInstrument: Map<string, { bid: number; ask: number }>
}

// ─── Pure computation helpers ───────────────────────────────────────────────

function computeOpenTradeProgress(
  trade: OpenTradeData,
): { clamped: number; slPips: number | null; tpPips: number | null } | null {
  const { stopLoss, takeProfit, entryPrice, currentPrice, direction, instrument } = trade

  if (!stopLoss && !takeProfit) return null
  if (!currentPrice) return null

  const slPips = stopLoss ? Math.abs(priceToPips(instrument, entryPrice - stopLoss)) : null
  const tpPips = takeProfit ? Math.abs(priceToPips(instrument, takeProfit - entryPrice)) : null
  const totalRange = (slPips ?? 0) + (tpPips ?? 0)
  if (totalRange === 0) return null

  const raw = priceToPips(instrument, currentPrice - entryPrice)
  const currentPips = direction === "long" ? raw : -raw

  const slSide = slPips ?? totalRange / 2
  const progress = ((currentPips + slSide) / totalRange) * 100
  const clamped = Math.max(0, Math.min(100, progress))

  return { clamped, slPips, tpPips }
}

function computeOpenTradeProximity(trade: OpenTradeData, threshold: number): ProximityTrade | null {
  const result = computeOpenTradeProgress(trade)
  if (!result) return null
  const { clamped, slPips, tpPips } = result

  // Near SL: progress ≤ (100 - threshold)
  const nearSlThreshold = 100 - threshold
  if (clamped <= nearSlThreshold && slPips !== null) {
    return {
      trade,
      progressPercent: clamped,
      proximityType: "sl",
      proximityPercent: 100 - clamped,
    }
  }

  // Near TP: progress ≥ threshold
  if (clamped >= threshold && tpPips !== null) {
    return {
      trade,
      progressPercent: clamped,
      proximityType: "tp",
      proximityPercent: clamped,
    }
  }

  return null
}

function computePendingFillPercent(
  order: PendingOrderData,
  currentPrice: number | null,
): number | null {
  if (!currentPrice) return null
  const info = calculateDistanceInfo(order.instrument, currentPrice, order.entryPrice)
  // Use SL distance as the reference scale; fall back to 100 pips if no SL
  const referencePips = order.stopLoss
    ? priceToPips(order.instrument, Math.abs(order.entryPrice - order.stopLoss))
    : 100
  const scale = Math.max(referencePips, 10)
  return Math.min(100, Math.max(0, (1 - info.pips / scale) * 100))
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePositionsDashboard(): PositionsDashboardData {
  const {
    positions,
    isLoaded,
    isConfigured,
    hasError,
    errorMessage,
    summary,
    openWithPrices,
    pricesByInstrument,
  } = usePositions()
  const { accountOverview } = useDaemonStatus()
  const currency = accountOverview?.summary.currency ?? "USD"

  const totalExposure = useMemo(
    () => openWithPrices.reduce((sum, t) => sum + t.unrealizedPL, 0),
    [openWithPrices],
  )

  // Track which items were previously in each proximity list (for hysteresis)
  const prevClosingIds = useRef(new Set<string>())
  const prevFillingIds = useRef(new Set<string>())

  const tradesNearClosing = useMemo(() => {
    const results: ProximityTrade[] = []
    for (const trade of openWithPrices) {
      // Use lower exit threshold for items already in the list
      const threshold = prevClosingIds.current.has(trade.id) ? PROXIMITY_EXIT : PROXIMITY_ENTER
      const p = computeOpenTradeProximity(trade, threshold)
      if (p) results.push(p)
    }
    // Sort by urgency: closest to boundary first
    results.sort((a, b) => b.proximityPercent - a.proximityPercent)
    const sliced = results.slice(0, 3)
    // Update ref for next render
    prevClosingIds.current = new Set(sliced.map((r) => r.trade.id))
    return sliced
  }, [openWithPrices])

  const ordersNearFilling = useMemo(() => {
    if (!positions?.pending) return []
    const results: ProximityOrder[] = []
    for (const order of positions.pending) {
      const tick = pricesByInstrument.get(order.instrument)
      const price = tick ? (order.direction === "long" ? tick.ask : tick.bid) : null
      const fillPercent = computePendingFillPercent(order, price)
      if (fillPercent === null) continue
      // Use lower exit threshold for items already in the list
      const threshold = prevFillingIds.current.has(order.id) ? PROXIMITY_EXIT : PROXIMITY_ENTER
      if (fillPercent >= threshold) {
        results.push({ order, fillPercent, currentPrice: price! })
      }
    }
    results.sort((a, b) => b.fillPercent - a.fillPercent)
    const sliced = results.slice(0, 3)
    // Update ref for next render
    prevFillingIds.current = new Set(sliced.map((r) => r.order.id))
    return sliced
  }, [positions?.pending, pricesByInstrument])

  const { bestPerformer, worstPerformer } = useMemo(() => {
    if (openWithPrices.length === 0) return { bestPerformer: null, worstPerformer: null }

    const best = openWithPrices.reduce((b, t) => (t.unrealizedPL > b.unrealizedPL ? t : b))
    const worst = openWithPrices.reduce((w, t) => (t.unrealizedPL < w.unrealizedPL ? t : w))

    // Single trade (or all identical P&L): assign to Best if profitable, Worst if losing
    if (best.id === worst.id) {
      return best.unrealizedPL >= 0
        ? { bestPerformer: best, worstPerformer: null }
        : { bestPerformer: null, worstPerformer: worst }
    }

    return { bestPerformer: best, worstPerformer: worst }
  }, [openWithPrices])

  const todayWinRate = useMemo(() => {
    const total = summary.todayWins + summary.todayLosses
    if (total === 0) return "—"
    return `${Math.round((summary.todayWins / total) * 100)}%`
  }, [summary.todayWins, summary.todayLosses])

  const recentClosed = useMemo(() => (positions?.closed ?? []).slice(0, 5), [positions?.closed])

  return {
    summary,
    totalExposure,
    currency,
    tradesNearClosing,
    ordersNearFilling,
    bestPerformer,
    worstPerformer,
    todayWins: summary.todayWins,
    todayLosses: summary.todayLosses,
    todayNetPL: summary.todayNetPL,
    todayWinRate,
    recentClosed,
    isLoaded,
    isConfigured,
    hasError,
    errorMessage,
    openWithPrices,
    pricesByInstrument,
  }
}
