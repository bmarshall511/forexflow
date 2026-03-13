"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { TVSignalPeriodPnLData } from "@fxflow/types"
import { useDaemonStatus } from "./use-daemon-status"

export function useTVAlertsPeriodPnL() {
  const [data, setData] = useState<TVSignalPeriodPnLData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { lastTVSignal } = useDaemonStatus()
  const lastSignalRef = useRef(lastTVSignal)

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch("/api/tv-alerts/stats/periods")
      const json = await res.json()
      if (json.ok) setData(json.data)
    } catch (err) {
      console.error("[useTVAlertsPeriodPnL] fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetch_()
  }, [fetch_])

  // Auto-refresh when a new signal arrives
  useEffect(() => {
    if (!lastTVSignal || lastTVSignal === lastSignalRef.current) return
    lastSignalRef.current = lastTVSignal
    void fetch_()
  }, [lastTVSignal, fetch_])

  return { data, isLoading, refresh: fetch_ }
}
