"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { TVAlertSignal } from "@fxflow/types"
import { useDaemonStatus } from "./use-daemon-status"

interface UseTVAlertsSignalsOptions {
  status?: string
  instrument?: string
  page?: number
  pageSize?: number
}

export function useTVAlertsSignals(opts: UseTVAlertsSignalsOptions = {}) {
  const [signals, setSignals] = useState<TVAlertSignal[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(opts.page ?? 1)
  const { lastTVSignal } = useDaemonStatus()
  const lastSignalRef = useRef<TVAlertSignal | null>(null)

  const fetchSignals = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("pageSize", String(opts.pageSize ?? 20))
      if (opts.status) params.set("status", opts.status)
      if (opts.instrument) params.set("instrument", opts.instrument)

      const res = await fetch(`/api/tv-alerts/signals?${params}`)
      const json = await res.json()
      if (json.ok) {
        setSignals(json.data.signals)
        setTotalCount(json.data.totalCount)
      }
    } catch (err) {
      console.error("[useTVAlertsSignals] fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [page, opts.status, opts.instrument, opts.pageSize])

  useEffect(() => {
    void fetchSignals()
  }, [fetchSignals])

  // Prepend new signals received via WebSocket
  useEffect(() => {
    if (!lastTVSignal || lastTVSignal === lastSignalRef.current) return
    lastSignalRef.current = lastTVSignal
    // Refresh to get full signal data
    void fetchSignals()
  }, [lastTVSignal, fetchSignals])

  const clearAll = useCallback(async () => {
    const res = await fetch("/api/tv-alerts/signals", { method: "DELETE" })
    const json = await res.json()
    if (!json.ok) throw new Error(json.error)
    setSignals([])
    setTotalCount(0)
    setPage(1)
  }, [])

  return { signals, totalCount, isLoading, refresh: fetchSignals, page, setPage, clearAll }
}
