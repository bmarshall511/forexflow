"use client"

import { useState, useEffect, useCallback } from "react"
import type {
  TradeFinderSetupData,
  TradeFinderScanStatus,
  TradeFinderAutoTradeEvent,
  TradeFinderCapUtilization,
} from "@fxflow/types"
import { useDaemonConnection } from "./use-daemon-connection"

const DAEMON_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100")
    : ""

export function useTradeFinder() {
  const [setups, setSetups] = useState<TradeFinderSetupData[]>([])
  const [history, setHistory] = useState<TradeFinderSetupData[]>([])
  const [scanStatus, setScanStatus] = useState<TradeFinderScanStatus | null>(null)
  const [autoTradeEvents, setAutoTradeEvents] = useState<TradeFinderAutoTradeEvent[]>([])
  const [capUtilization, setCapUtilization] = useState<TradeFinderCapUtilization | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const {
    lastTradeFinderSetup,
    lastTradeFinderRemoved,
    tradeFinderScanStatus,
    lastAutoTradeEvent,
    tradeFinderCapUtilization,
  } = useDaemonConnection()

  // Fetch active setups
  const fetchSetups = useCallback(async () => {
    try {
      const res = await fetch("/api/trade-finder/setups")
      const json = await res.json()
      if (json.ok) setSetups(json.data)
    } catch (err) {
      console.error("[useTradeFinder] fetch setups error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/trade-finder/history?limit=50")
      const json = await res.json()
      if (json.ok) setHistory(json.data)
    } catch (err) {
      console.error("[useTradeFinder] fetch history error:", err)
    }
  }, [])

  // Fetch scan status from daemon
  const fetchScanStatus = useCallback(async () => {
    try {
      const res = await fetch(`${DAEMON_URL}/trade-finder/status`)
      const json = await res.json()
      if (json.ok) setScanStatus(json.data)
    } catch {
      // Daemon might not be connected
    }
  }, [])

  // Fetch auto-trade events from daemon
  const fetchAutoTradeEvents = useCallback(async () => {
    try {
      const res = await fetch(`${DAEMON_URL}/trade-finder/auto-trade-events`)
      const json = await res.json()
      if (json.ok) setAutoTradeEvents(json.data)
    } catch {
      // Daemon might not be connected
    }
  }, [])

  // Fetch cap utilization from daemon
  const fetchCapUtilization = useCallback(async () => {
    try {
      const res = await fetch(`${DAEMON_URL}/trade-finder/caps`)
      const json = await res.json()
      if (json.ok) setCapUtilization(json.data)
    } catch {
      // Daemon might not be connected
    }
  }, [])

  useEffect(() => {
    void fetchSetups()
    void fetchHistory()
    void fetchScanStatus()
    void fetchAutoTradeEvents()
    void fetchCapUtilization()
  }, [fetchSetups, fetchHistory, fetchScanStatus, fetchAutoTradeEvents, fetchCapUtilization])

  // Handle real-time WS: setup found/updated
  useEffect(() => {
    if (!lastTradeFinderSetup) return
    setSetups((prev) => {
      const exists = prev.find((s) => s.id === lastTradeFinderSetup.id)
      if (exists) {
        return prev.map((s) => (s.id === lastTradeFinderSetup.id ? lastTradeFinderSetup : s))
      }
      return [lastTradeFinderSetup, ...prev].sort((a, b) => b.scores.total - a.scores.total)
    })
  }, [lastTradeFinderSetup])

  // Handle real-time WS: setup removed
  useEffect(() => {
    if (!lastTradeFinderRemoved) return
    setSetups((prev) => prev.filter((s) => s.id !== lastTradeFinderRemoved.setupId))
    void fetchHistory()
  }, [lastTradeFinderRemoved, fetchHistory])

  // Handle real-time WS: scan status
  useEffect(() => {
    if (tradeFinderScanStatus) setScanStatus(tradeFinderScanStatus)
  }, [tradeFinderScanStatus])

  // Handle real-time WS: auto-trade events
  useEffect(() => {
    if (!lastAutoTradeEvent) return
    setAutoTradeEvents((prev) => {
      const next = [lastAutoTradeEvent, ...prev]
      return next.length > 50 ? next.slice(0, 50) : next
    })
    // Merge skip reason into setup state
    if (lastAutoTradeEvent.type === "skipped") {
      setSetups((prev) =>
        prev.map((s) =>
          s.id === lastAutoTradeEvent.setupId
            ? { ...s, lastSkipReason: lastAutoTradeEvent.reason ?? null }
            : s,
        ),
      )
    }
    // Refresh setups/history when a placement or fill happens
    if (lastAutoTradeEvent.type === "placed" || lastAutoTradeEvent.type === "filled") {
      void fetchSetups()
      void fetchHistory()
    }
  }, [lastAutoTradeEvent, fetchSetups, fetchHistory])

  // Handle real-time WS: cap utilization
  useEffect(() => {
    if (tradeFinderCapUtilization) setCapUtilization(tradeFinderCapUtilization)
  }, [tradeFinderCapUtilization])

  // Trigger manual scan
  const triggerScan = useCallback(async () => {
    try {
      await fetch(`${DAEMON_URL}/actions/trade-finder/scan`, { method: "POST" })
    } catch (err) {
      console.error("[useTradeFinder] trigger scan error:", err)
    }
  }, [])

  // Place order from setup
  const placeOrder = useCallback(
    async (setupId: string, orderType: "MARKET" | "LIMIT" = "LIMIT") => {
      const res = await fetch(`${DAEMON_URL}/actions/trade-finder/place/${setupId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderType }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      void fetchSetups()
      void fetchHistory()
      return json.data
    },
    [fetchSetups, fetchHistory],
  )

  // Clear active setups
  const clearActive = useCallback(async () => {
    const res = await fetch(`${DAEMON_URL}/actions/trade-finder/clear-active`, { method: "POST" })
    const json = await res.json()
    if (!json.ok) throw new Error(json.error)
    setSetups([])
    return json.data.cleared as number
  }, [])

  // Clear history
  const clearHistory = useCallback(async () => {
    const res = await fetch(`${DAEMON_URL}/actions/trade-finder/clear-history`, { method: "POST" })
    const json = await res.json()
    if (!json.ok) throw new Error(json.error)
    setHistory([])
    return json.data.cleared as number
  }, [])

  // Clear activity log
  const clearActivity = useCallback(async () => {
    const res = await fetch(`${DAEMON_URL}/actions/trade-finder/clear-activity`, { method: "POST" })
    const json = await res.json()
    if (!json.ok) throw new Error(json.error)
    setAutoTradeEvents([])
  }, [])

  return {
    setups,
    history,
    scanStatus,
    autoTradeEvents,
    capUtilization,
    isLoading,
    triggerScan,
    placeOrder,
    clearActive,
    clearHistory,
    clearActivity,
    refresh: fetchSetups,
    refreshHistory: fetchHistory,
  }
}
