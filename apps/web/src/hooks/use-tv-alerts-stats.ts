"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { TVSignalPerformanceStats } from "@fxflow/types"
import { useDaemonStatus } from "./use-daemon-status"

export function useTVAlertsStats() {
  const [stats, setStats] = useState<TVSignalPerformanceStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { lastTVSignal } = useDaemonStatus()
  const lastSignalRef = useRef(lastTVSignal)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/tv-alerts/stats")
      const json = await res.json()
      if (json.ok) setStats(json.data)
    } catch (err) {
      console.error("[useTVAlertsStats] fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

  // Auto-refresh when a new signal arrives
  useEffect(() => {
    if (!lastTVSignal || lastTVSignal === lastSignalRef.current) return
    lastSignalRef.current = lastTVSignal
    void fetchStats()
  }, [lastTVSignal, fetchStats])

  return { stats, isLoading, refresh: fetchStats }
}
