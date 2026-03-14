"use client"

import { useEffect, useMemo, useState } from "react"
import { useDaemonStatus } from "./use-daemon-status"
import { usePositions } from "./use-positions"
import type { OpenTradeData } from "@fxflow/types"
import type { DrawdownData } from "@/app/api/risk/drawdown/route"
import { getPipSize } from "@fxflow/shared"

export interface TradeRisk {
  tradeId: string
  instrument: string
  direction: "long" | "short"
  riskAmount: number
  riskPercent: number
}

export interface CorrelationEntry {
  pairA: string
  pairB: string
  correlation: number
  sameDirection: boolean
}

export interface UseRiskDashboardReturn {
  /** Total portfolio heat as percentage of balance */
  portfolioHeat: number
  /** Risk breakdown per open trade */
  tradeRisks: TradeRisk[]
  /** Correlation warnings between open positions */
  correlationEntries: CorrelationEntry[]
  /** Drawdown data from API */
  drawdown: DrawdownData | null
  drawdownLoading: boolean
  /** Account balance for position sizer */
  accountBalance: number
  /** Account currency */
  accountCurrency: string
  /** Open trades with live prices */
  openTrades: OpenTradeData[]
}

/** Known approximate correlations between major forex pairs (absolute values). */
const PAIR_CORRELATIONS: Record<string, Record<string, number>> = {
  EUR_USD: { GBP_USD: 0.85, AUD_USD: 0.7, NZD_USD: 0.65, USD_CHF: -0.9, USD_CAD: -0.5 },
  GBP_USD: { EUR_USD: 0.85, AUD_USD: 0.6, NZD_USD: 0.55, USD_CHF: -0.8, USD_CAD: -0.4 },
  AUD_USD: { EUR_USD: 0.7, GBP_USD: 0.6, NZD_USD: 0.9, USD_CAD: -0.5 },
  NZD_USD: { EUR_USD: 0.65, GBP_USD: 0.55, AUD_USD: 0.9, USD_CAD: -0.4 },
  USD_CHF: { EUR_USD: -0.9, GBP_USD: -0.8, USD_CAD: 0.5 },
  USD_CAD: { EUR_USD: -0.5, GBP_USD: -0.4, AUD_USD: -0.5, NZD_USD: -0.4, USD_CHF: 0.5 },
  EUR_JPY: { GBP_JPY: 0.9, USD_JPY: 0.6 },
  GBP_JPY: { EUR_JPY: 0.9, USD_JPY: 0.65 },
}

function getCorrelationValue(a: string, b: string): number | null {
  return PAIR_CORRELATIONS[a]?.[b] ?? PAIR_CORRELATIONS[b]?.[a] ?? null
}

export function useRiskDashboard(): UseRiskDashboardReturn {
  const { accountOverview } = useDaemonStatus()
  const { openWithPrices } = usePositions()
  const [drawdown, setDrawdown] = useState<DrawdownData | null>(null)
  const [drawdownLoading, setDrawdownLoading] = useState(true)

  const balance = accountOverview?.summary.balance ?? 0
  const currency = accountOverview?.summary.currency ?? "USD"

  useEffect(() => {
    fetch("/api/risk/drawdown")
      .then((res) => (res.ok ? (res.json() as Promise<{ ok: boolean; data: DrawdownData }>) : null))
      .then((json) => {
        if (json?.ok) setDrawdown(json.data)
      })
      .catch(() => {})
      .finally(() => setDrawdownLoading(false))
  }, [])

  const tradeRisks = useMemo((): TradeRisk[] => {
    if (balance <= 0) return []
    return openWithPrices.map((trade) => {
      const pipSize = getPipSize(trade.instrument)
      let riskAmount = 0
      if (trade.stopLoss !== null) {
        const slDistance = Math.abs(trade.entryPrice - trade.stopLoss)
        riskAmount = slDistance * Math.abs(trade.currentUnits) * (1 / pipSize) * pipSize
      } else {
        // No SL: estimate risk as 2% of position value as warning
        riskAmount = Math.abs(trade.currentUnits) * trade.entryPrice * 0.02
      }
      return {
        tradeId: trade.id,
        instrument: trade.instrument,
        direction: trade.direction,
        riskAmount,
        riskPercent: (riskAmount / balance) * 100,
      }
    })
  }, [openWithPrices, balance])

  const portfolioHeat = useMemo(
    () => tradeRisks.reduce((sum, r) => sum + r.riskPercent, 0),
    [tradeRisks],
  )

  const correlationEntries = useMemo((): CorrelationEntry[] => {
    const instruments = openWithPrices.map((t) => ({
      instrument: t.instrument,
      direction: t.direction,
    }))
    const entries: CorrelationEntry[] = []
    for (let i = 0; i < instruments.length; i++) {
      for (let j = i + 1; j < instruments.length; j++) {
        const a = instruments[i]!
        const b = instruments[j]!
        if (a.instrument === b.instrument) continue
        const corr = getCorrelationValue(a.instrument, b.instrument)
        if (corr !== null && Math.abs(corr) >= 0.5) {
          const sameDirection = corr > 0 ? a.direction === b.direction : a.direction !== b.direction
          entries.push({
            pairA: a.instrument,
            pairB: b.instrument,
            correlation: corr,
            sameDirection,
          })
        }
      }
    }
    return entries.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
  }, [openWithPrices])

  return {
    portfolioHeat,
    tradeRisks,
    correlationEntries,
    drawdown,
    drawdownLoading,
    accountBalance: balance,
    accountCurrency: currency,
    openTrades: openWithPrices,
  }
}
