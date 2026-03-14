"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useDaemonStatus } from "./use-daemon-status"
import type {
  PerformanceSummary,
  EquityCurvePoint,
  InstrumentPerformance,
  SessionPerformance,
  TVSignalPerformanceStats,
  TVSignalPeriodPnLData,
  TVAlertsDetailedStats,
} from "@fxflow/types"

export type PerfPeriod = "7d" | "30d" | "90d" | "all"

function periodToDateFrom(period: PerfPeriod): string | undefined {
  if (period === "all") return undefined
  const d = new Date()
  if (period === "7d") d.setDate(d.getDate() - 7)
  else if (period === "30d") d.setDate(d.getDate() - 30)
  else if (period === "90d") d.setDate(d.getDate() - 90)
  return d.toISOString()
}

interface PerfData {
  summary: PerformanceSummary | null
  summaryLong: PerformanceSummary | null
  summaryShort: PerformanceSummary | null
  equityCurve: EquityCurvePoint[]
  byInstrument: InstrumentPerformance[]
  bySession: SessionPerformance[]
  periodPnl: TVSignalPeriodPnLData | null
  signalStats: TVSignalPerformanceStats | null
  detailed: TVAlertsDetailedStats | null
  isLoading: boolean
  period: PerfPeriod
  setPeriod: (p: PerfPeriod) => void
}

const SOURCE = "ut_bot_alerts"

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    const json = await res.json()
    return json.ok ? json.data : null
  } catch {
    return null
  }
}

export function useTVAlertsPerformance(): PerfData {
  const [period, setPeriod] = useState<PerfPeriod>("all")
  const [summary, setSummary] = useState<PerformanceSummary | null>(null)
  const [summaryLong, setSummaryLong] = useState<PerformanceSummary | null>(null)
  const [summaryShort, setSummaryShort] = useState<PerformanceSummary | null>(null)
  const [equityCurve, setEquityCurve] = useState<EquityCurvePoint[]>([])
  const [byInstrument, setByInstrument] = useState<InstrumentPerformance[]>([])
  const [bySession, setBySession] = useState<SessionPerformance[]>([])
  const [periodPnl, setPeriodPnl] = useState<TVSignalPeriodPnLData | null>(null)
  const [signalStats, setSignalStats] = useState<TVSignalPerformanceStats | null>(null)
  const [detailed, setDetailed] = useState<TVAlertsDetailedStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { lastTVSignal } = useDaemonStatus()
  const lastSignalRef = useRef(lastTVSignal)

  const fetchAll = useCallback(async (p: PerfPeriod) => {
    setIsLoading(true)
    const dateFrom = periodToDateFrom(p)
    const dateQ = dateFrom ? `&dateFrom=${dateFrom}` : ""
    const fromQ = dateFrom ? `?from=${dateFrom}` : ""
    const analyticsQ = `?source=${SOURCE}${dateFrom ? `&dateFrom=${dateFrom}` : ""}`

    const [sum, sumL, sumS, eq, inst, sess, pnl, sig, det] = await Promise.all([
      fetchJson<PerformanceSummary>(`/api/analytics/summary${analyticsQ}`),
      fetchJson<PerformanceSummary>(`/api/analytics/summary${analyticsQ}&direction=long`),
      fetchJson<PerformanceSummary>(`/api/analytics/summary${analyticsQ}&direction=short`),
      fetchJson<EquityCurvePoint[]>(`/api/analytics/equity-curve${analyticsQ}`),
      fetchJson<InstrumentPerformance[]>(`/api/analytics/by-instrument${analyticsQ}`),
      fetchJson<SessionPerformance[]>(`/api/analytics/by-session${analyticsQ}`),
      fetchJson<TVSignalPeriodPnLData>("/api/tv-alerts/stats/periods"),
      fetchJson<TVSignalPerformanceStats>(`/api/tv-alerts/stats${fromQ ? fromQ : ""}`),
      fetchJson<TVAlertsDetailedStats>(`/api/tv-alerts/stats/detailed${fromQ ? fromQ : ""}`),
    ])

    setSummary(sum)
    setSummaryLong(sumL)
    setSummaryShort(sumS)
    setEquityCurve(eq ?? [])
    setByInstrument(inst ?? [])
    setBySession(sess ?? [])
    setPeriodPnl(pnl)
    setSignalStats(sig)
    setDetailed(det)
    setIsLoading(false)
  }, [])

  // Initial load + period change
  useEffect(() => {
    void fetchAll(period)
  }, [period, fetchAll])

  // Auto-refresh on new signal
  useEffect(() => {
    if (!lastTVSignal || lastTVSignal === lastSignalRef.current) return
    lastSignalRef.current = lastTVSignal
    void fetchAll(period)
  }, [lastTVSignal, fetchAll, period])

  return useMemo(
    () => ({
      summary,
      summaryLong,
      summaryShort,
      equityCurve,
      byInstrument,
      bySession,
      periodPnl,
      signalStats,
      detailed,
      isLoading,
      period,
      setPeriod,
    }),
    [
      summary,
      summaryLong,
      summaryShort,
      equityCurve,
      byInstrument,
      bySession,
      periodPnl,
      signalStats,
      detailed,
      isLoading,
      period,
    ],
  )
}
