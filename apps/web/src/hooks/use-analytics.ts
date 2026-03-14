"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type {
  AnalyticsFilters,
  PerformanceSummary,
  InstrumentPerformance,
  SessionPerformance,
  DayOfWeekPerformance,
  HourOfDayPerformance,
  SourcePerformance,
  MfeMaeEntry,
  EquityCurvePoint,
} from "@fxflow/types"

function buildQuery(filters: AnalyticsFilters): string {
  const params = new URLSearchParams()
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom.toISOString())
  if (filters.dateTo) params.set("dateTo", filters.dateTo.toISOString())
  if (filters.instrument) params.set("instrument", filters.instrument)
  if (filters.source) params.set("source", filters.source)
  if (filters.direction) params.set("direction", filters.direction)
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    const json = await res.json()
    return json.ok ? (json.data as T) : null
  } catch (err) {
    console.error(`[useAnalytics] fetch ${url} error:`, err)
    return null
  }
}

interface TimeData {
  byDayOfWeek: DayOfWeekPerformance[]
  byHourOfDay: HourOfDayPerformance[]
}

export interface AnalyticsData {
  summary: PerformanceSummary | null
  equityCurve: EquityCurvePoint[]
  byInstrument: InstrumentPerformance[]
  bySession: SessionPerformance[]
  byTime: TimeData | null
  bySource: SourcePerformance[]
  edge: MfeMaeEntry[]
  isLoading: boolean
  isTabLoading: boolean
  refetch: () => void
  fetchTab: (tab: string) => void
}

export function useAnalytics(filters: AnalyticsFilters): AnalyticsData {
  const [summary, setSummary] = useState<PerformanceSummary | null>(null)
  const [equityCurve, setEquityCurve] = useState<EquityCurvePoint[]>([])
  const [byInstrument, setByInstrument] = useState<InstrumentPerformance[]>([])
  const [bySession, setBySession] = useState<SessionPerformance[]>([])
  const [byTime, setByTime] = useState<TimeData | null>(null)
  const [bySource, setBySource] = useState<SourcePerformance[]>([])
  const [edge, setEdge] = useState<MfeMaeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTabLoading, setIsTabLoading] = useState(false)
  const fetchedTabs = useRef<Set<string>>(new Set())

  const fetchCore = useCallback(async () => {
    const qs = buildQuery(filters)
    setIsLoading(true)
    fetchedTabs.current.clear()
    const [s, ec] = await Promise.all([
      fetchJson<PerformanceSummary>(`/api/analytics/summary${qs}`),
      fetchJson<EquityCurvePoint[]>(`/api/analytics/equity-curve${qs}`),
    ])
    setSummary(s)
    setEquityCurve(ec ?? [])
    setIsLoading(false)
  }, [filters])

  const fetchTab = useCallback(
    async (tab: string) => {
      if (fetchedTabs.current.has(tab)) return
      fetchedTabs.current.add(tab)
      const qs = buildQuery(filters)
      setIsTabLoading(true)

      switch (tab) {
        case "instrument": {
          const d = await fetchJson<InstrumentPerformance[]>(`/api/analytics/by-instrument${qs}`)
          setByInstrument(d ?? [])
          break
        }
        case "session": {
          const d = await fetchJson<SessionPerformance[]>(`/api/analytics/by-session${qs}`)
          setBySession(d ?? [])
          break
        }
        case "time": {
          const d = await fetchJson<TimeData>(`/api/analytics/by-time${qs}`)
          setByTime(d)
          break
        }
        case "source": {
          const d = await fetchJson<SourcePerformance[]>(`/api/analytics/by-source${qs}`)
          setBySource(d ?? [])
          break
        }
        case "edge": {
          const d = await fetchJson<MfeMaeEntry[]>(`/api/analytics/edge${qs}`)
          setEdge(d ?? [])
          break
        }
      }
      setIsTabLoading(false)
    },
    [filters],
  )

  useEffect(() => {
    void fetchCore()
  }, [fetchCore])

  const refetch = useCallback(() => {
    fetchedTabs.current.clear()
    void fetchCore()
  }, [fetchCore])

  return {
    summary,
    equityCurve,
    byInstrument,
    bySession,
    byTime,
    bySource,
    edge,
    isLoading,
    isTabLoading,
    refetch,
    fetchTab,
  }
}
