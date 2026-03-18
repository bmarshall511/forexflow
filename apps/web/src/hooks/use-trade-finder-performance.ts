"use client"

import { useState, useEffect, useCallback } from "react"
import type { TradeFinderPerformanceData } from "@fxflow/db"

export type PeriodDays = 7 | 30 | 90 | 0

interface UseTradeFinderPerformanceReturn {
  overall: TradeFinderPerformanceData | null
  byTimeframe: TradeFinderPerformanceData[]
  byInstrument: TradeFinderPerformanceData[]
  byScoreRange: TradeFinderPerformanceData[]
  period: PeriodDays
  setPeriod: (days: PeriodDays) => void
  isLoading: boolean
}

export function useTradeFinderPerformance(): UseTradeFinderPerformanceReturn {
  const [overall, setOverall] = useState<TradeFinderPerformanceData | null>(null)
  const [byTimeframe, setByTimeframe] = useState<TradeFinderPerformanceData[]>([])
  const [byInstrument, setByInstrument] = useState<TradeFinderPerformanceData[]>([])
  const [byScoreRange, setByScoreRange] = useState<TradeFinderPerformanceData[]>([])
  const [period, setPeriod] = useState<PeriodDays>(90)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async (days: PeriodDays) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/trade-finder/performance?daysBack=${days}`)
      const json = await res.json()
      if (json.ok) {
        setOverall(json.data.overall)
        setByTimeframe(json.data.byTimeframe)
        setByInstrument(json.data.byInstrument)
        setByScoreRange(json.data.byScoreRange)
      }
    } catch {
      // Silently fail — performance data is non-critical
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData(period)
  }, [period, fetchData])

  return { overall, byTimeframe, byInstrument, byScoreRange, period, setPeriod, isLoading }
}
