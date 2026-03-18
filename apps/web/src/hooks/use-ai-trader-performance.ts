"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { AiTraderStrategyPerformanceData, EquityCurvePoint } from "@fxflow/types"
import type { AiTraderFunnelStats, AiTraderCostStats } from "@fxflow/db"

export type PeriodDays = 7 | 30 | 90 | 0

export interface UseAiTraderPerformanceReturn {
  stats: AiTraderStrategyPerformanceData[]
  overall: AiTraderStrategyPerformanceData | null
  equityCurve: EquityCurvePoint[]
  funnel: AiTraderFunnelStats
  costs: AiTraderCostStats | null
  period: PeriodDays
  setPeriod: (p: PeriodDays) => void
  isLoading: boolean
}

const EMPTY_FUNNEL: AiTraderFunnelStats = {
  detected: 0,
  suggested: 0,
  approved: 0,
  placed: 0,
  filled: 0,
  managed: 0,
  closed: 0,
  rejected: 0,
  expired: 0,
  skipped: 0,
}

export function useAiTraderPerformance(): UseAiTraderPerformanceReturn {
  const [stats, setStats] = useState<AiTraderStrategyPerformanceData[]>([])
  const [overall, setOverall] = useState<AiTraderStrategyPerformanceData | null>(null)
  const [equityCurve, setEquityCurve] = useState<EquityCurvePoint[]>([])
  const [funnel, setFunnel] = useState<AiTraderFunnelStats | null>(null)
  const [costs, setCosts] = useState<AiTraderCostStats | null>(null)
  const [period, setPeriod] = useState<PeriodDays>(90)
  const [isLoading, setIsLoading] = useState(true)
  const hasFetched = useRef(false)

  const fetchData = useCallback(async (days: PeriodDays) => {
    if (!hasFetched.current) setIsLoading(true)
    try {
      const res = await fetch(`/api/ai-trader/performance?daysBack=${days}`)
      if (!res.ok) return
      const json = (await res.json()) as {
        ok: boolean
        data?: {
          stats: AiTraderStrategyPerformanceData[]
          overall: AiTraderStrategyPerformanceData | null
          equityCurve: EquityCurvePoint[]
          funnel: AiTraderFunnelStats
          costs: AiTraderCostStats
        }
      }
      if (json.ok && json.data) {
        setStats(json.data.stats)
        setOverall(json.data.overall)
        setEquityCurve(json.data.equityCurve)
        setFunnel(json.data.funnel)
        setCosts(json.data.costs)
      }
    } catch {
      // API may be unavailable
    } finally {
      setIsLoading(false)
      hasFetched.current = true
    }
  }, [])

  useEffect(() => {
    void fetchData(period)
  }, [period, fetchData])

  return {
    stats,
    overall,
    equityCurve,
    funnel: funnel ?? EMPTY_FUNNEL,
    costs,
    period,
    setPeriod,
    isLoading,
  }
}
