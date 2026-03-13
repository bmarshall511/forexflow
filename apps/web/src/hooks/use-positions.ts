"use client"

import { useMemo, useRef } from "react"
import { useDaemonStatus } from "./use-daemon-status"
import type {
  PositionsData,
  PositionsSummary,
  PositionPriceTick,
  OpenTradeData,
} from "@fxflow/types"

export interface UsePositionsReturn {
  positions: PositionsData | null
  isLoaded: boolean
  isConfigured: boolean
  /** Whether a connection error has been reported (health check ran but failed) */
  hasError: boolean
  /** Error message from OANDA health check */
  errorMessage: string | null
  summary: PositionsSummary
  pricesByInstrument: Map<string, PositionPriceTick>
  openWithPrices: OpenTradeData[]
}

const EMPTY_SUMMARY: PositionsSummary = {
  pendingCount: 0,
  openCount: 0,
  closedTodayCount: 0,
  todayWins: 0,
  todayLosses: 0,
  todayNetPL: 0,
}

export function usePositions(): UsePositionsReturn {
  const { isConnected, oanda, positions, positionsPrices } = useDaemonStatus()

  const isLoaded = positions !== null
  const isConfigured = oanda?.status !== "unconfigured"

  // Health check has run and reported an error (not just "hasn't loaded yet")
  const hasError = oanda !== null
    && oanda.status !== "unconfigured"
    && oanda.lastHealthCheck !== null
    && !oanda.accountValid
  const errorMessage = oanda?.errorMessage ?? null

  // Accumulate price ticks across partial WebSocket updates (merge, not replace)
  const priceAccumulator = useRef(new Map<string, PositionPriceTick>())

  // Clear accumulator when positions reset (e.g. connection drop)
  if (!positions) {
    priceAccumulator.current.clear()
  }

  const pricesByInstrument = useMemo(() => {
    if (positionsPrices?.prices) {
      for (const tick of positionsPrices.prices) {
        priceAccumulator.current.set(tick.instrument, tick)
      }
    }
    return new Map(priceAccumulator.current)
  }, [positionsPrices])

  // Merge latest prices into open trades + compute live unrealized P/L
  const openWithPrices = useMemo(() => {
    if (!positions?.open) return []

    return positions.open.map((trade) => {
      const tick = pricesByInstrument.get(trade.instrument)
      if (!tick) return trade

      const currentPrice = trade.direction === "long" ? tick.bid : tick.ask
      // Compute live unrealized P/L from price movement
      const unrealizedPL = trade.direction === "long"
        ? (currentPrice - trade.entryPrice) * trade.currentUnits
        : (trade.entryPrice - currentPrice) * trade.currentUnits
      return {
        ...trade,
        currentPrice,
        unrealizedPL,
      }
    })
  }, [positions?.open, pricesByInstrument])

  // Derive summary from positions data
  const summary = useMemo((): PositionsSummary => {
    if (!positions) return EMPTY_SUMMARY

    const todayWins = positions.closed.filter((t) => t.outcome === "win").length
    const todayLosses = positions.closed.filter((t) => t.outcome === "loss").length
    const todayNetPL = positions.closed.reduce(
      (sum, t) => sum + t.realizedPL + t.financing,
      0,
    )

    return {
      pendingCount: positions.pending.length,
      openCount: positions.open.length,
      closedTodayCount: positions.closed.length,
      todayWins,
      todayLosses,
      todayNetPL,
    }
  }, [positions])

  return {
    positions,
    isLoaded,
    isConfigured,
    hasError,
    errorMessage,
    summary,
    pricesByInstrument,
    openWithPrices,
  }
}
