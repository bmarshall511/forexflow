"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { useDaemonConnection } from "./use-daemon-connection"

export interface SidebarStatus {
  /** Primary status line */
  line1: string
  /** Secondary line */
  line2?: string
  /** Visual variant for coloring */
  variant: "default" | "active" | "warning" | "error"
}

/** Returns a map of statusKey → SidebarStatus for nav items with dynamic status text. */
export function useSidebarStatus(): Record<string, SidebarStatus> {
  const { tradeFinderScanStatus, tradeFinderSetupCounts } = useTradeFinderNavData()
  const { lastAiTraderScanStatus, lastAiTraderScanProgress } = useDaemonConnection()
  const smartFlowNavData = useSmartFlowNavData()

  return useMemo(() => {
    const result: Record<string, SidebarStatus> = {}

    // ─── SmartFlow status ─────────────────────────────────────────────
    if (smartFlowNavData) {
      const {
        scannerEnabled,
        scanning,
        lastScanAt,
        nextScanAt,
        found,
        placed,
        activeTrades,
        paused,
        pauseReason,
        error,
      } = smartFlowNavData
      let line1: string
      let line2: string | undefined
      let variant: SidebarStatus["variant"] = "default"

      if (error) {
        line1 = "Something went wrong"
        variant = "error"
      } else if (!scannerEnabled) {
        line1 = "Scanner off"
        variant = "default"
      } else if (paused) {
        line1 = pauseReason ?? "Paused"
        variant = "warning"
      } else if (scanning) {
        line1 = "Scanning markets..."
        variant = "active"
      } else if (nextScanAt) {
        line1 = `Scans again in ${formatCountdown(nextScanAt)}`
      } else if (lastScanAt) {
        line1 = `Scanned ${formatTimeAgo(lastScanAt)}`
      } else {
        line1 = "Ready"
      }

      if (activeTrades > 0) {
        line2 = `${activeTrades} trade${activeTrades !== 1 ? "s" : ""} active`
      } else if (found > 0) {
        line2 = `${found} found, ${placed} placed`
      } else if (scannerEnabled && lastScanAt) {
        line2 = "No opportunities right now"
      }

      result.smartFlow = { line1, line2, variant }
    }

    // ─── EdgeFinder status ────────────────────────────────────────────
    if (lastAiTraderScanStatus) {
      const { scanning, enabled, paused, error, openAiTradeCount, lastScanAt, nextScanAt } =
        lastAiTraderScanStatus
      let line1: string
      let line2: string | undefined
      let variant: SidebarStatus["variant"] = "default"

      if (error) {
        line1 = "Something went wrong"
        variant = "error"
      } else if (!enabled) {
        line1 = "Disabled in settings"
        variant = "default"
      } else if (paused) {
        line1 = "Paused"
        variant = "warning"
      } else if (scanning && lastAiTraderScanProgress) {
        const { phase, pairsScanned, pairsTotal } = lastAiTraderScanProgress
        if (phase === "scanning_pairs" && pairsTotal > 0) {
          line1 = `Scanning ${pairsScanned}/${pairsTotal} pairs`
        } else if (phase === "analyzing_candidates") {
          line1 = "AI analyzing candidates..."
        } else {
          line1 = "Scanning..."
        }
        variant = "active"
      } else if (nextScanAt) {
        line1 = `Scans again in ${formatCountdown(nextScanAt)}`
      } else if (lastScanAt) {
        line1 = `Scanned ${formatTimeAgo(lastScanAt)}`
      } else {
        line1 = "Connecting..."
      }

      if (openAiTradeCount > 0) {
        line2 = `${openAiTradeCount} trade${openAiTradeCount !== 1 ? "s" : ""} open`
      } else if (enabled && !error) {
        line2 = "No open trades"
      }

      result.aiTrader = { line1, line2, variant }
    }

    // ─── Trade Finder status ──────────────────────────────────────────
    if (tradeFinderScanStatus) {
      const { isScanning, pairsScanned, totalPairs, lastScanAt, nextScanAt, error, currentPair } =
        tradeFinderScanStatus

      let line1: string
      let line2: string | undefined
      let variant: SidebarStatus["variant"] = "default"

      if (error) {
        line1 = "Something went wrong"
        variant = "error"
      } else if (isScanning) {
        const pairLabel = currentPair ? currentPair.replace("_", "/") : ""
        line1 = pairLabel
          ? `Checking ${pairLabel} (${pairsScanned}/${totalPairs})`
          : `Checking ${pairsScanned} of ${totalPairs} pairs...`
        variant = "active"
      } else if (nextScanAt) {
        line1 = `Scans again in ${formatCountdown(nextScanAt)}`
      } else if (lastScanAt) {
        line1 = `Scanned ${formatTimeAgo(lastScanAt)}`
      } else {
        line1 = "Not running"
      }

      const { active, approaching } = tradeFinderSetupCounts
      const total = active + approaching
      if (total > 0) {
        line2 =
          approaching > 0
            ? `${total} found, ${approaching} close to entry`
            : `${total} trade idea${total !== 1 ? "s" : ""} found`
      } else if (!isScanning && !error) {
        line2 = "No trade ideas right now"
      }

      result.tradeFinder = { line1, line2, variant }
    }

    return result
  }, [
    smartFlowNavData,
    tradeFinderScanStatus,
    tradeFinderSetupCounts,
    lastAiTraderScanStatus,
    lastAiTraderScanProgress,
  ])
}

/** Gathers Trade Finder data needed for the sidebar nav status. */
function useTradeFinderNavData() {
  const { tradeFinderScanStatus } = useDaemonConnection()
  const [setupCounts, setSetupCounts] = useState({ active: 0, approaching: 0 })
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const fetchCounts = async () => {
      try {
        const res = await fetch("/api/trade-finder/setups")
        const json = await res.json()
        if (!mountedRef.current || !json.ok) return
        const setups = json.data as Array<{ status: string }>
        setSetupCounts({
          active: setups.filter((s) => s.status === "active").length,
          approaching: setups.filter((s) => s.status === "approaching").length,
        })
      } catch {
        // Non-critical
      }
    }
    void fetchCounts()
    const interval = setInterval(fetchCounts, 30_000)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [])

  return {
    tradeFinderScanStatus,
    tradeFinderSetupCounts: setupCounts,
  }
}

/** Gathers SmartFlow scanner data for the sidebar nav status. */
function useSmartFlowNavData() {
  const [data, setData] = useState<{
    scannerEnabled: boolean
    scanning: boolean
    lastScanAt: string | null
    nextScanAt: string | null
    found: number
    placed: number
    activeTrades: number
    paused: boolean
    pauseReason: string | null
    error: boolean
  } | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const fetchData = async () => {
      try {
        const res = await fetch("/api/daemon/smart-flow/scanner/status")
        if (!res.ok || !mountedRef.current) return
        const json = (await res.json()) as {
          ok: boolean
          progress: {
            phase: string
            lastScanAt: string | null
            nextScanAt: string | null
            opportunitiesFound: number
            opportunitiesPlaced: number
          } | null
          circuitBreaker: { paused: boolean; reason: string | null } | null
        }
        if (!json.ok || !mountedRef.current) return

        // Also fetch active trade count
        let activeTrades = 0
        try {
          const tradesRes = await fetch("/api/smart-flow/trades")
          if (tradesRes.ok) {
            const tradesJson = (await tradesRes.json()) as {
              ok: boolean
              data?: Array<{ status: string }>
            }
            if (tradesJson.ok && tradesJson.data) {
              activeTrades = tradesJson.data.filter(
                (t) => t.status !== "closed" && t.status !== "waiting_entry",
              ).length
            }
          }
        } catch {
          // Non-critical
        }

        const p = json.progress
        const scanning =
          p?.phase === "scanning" || p?.phase === "analyzing" || p?.phase === "placing"
        setData({
          scannerEnabled: (p != null && p.phase !== "idle") || p?.lastScanAt != null,
          scanning: scanning ?? false,
          lastScanAt: p?.lastScanAt ?? null,
          nextScanAt: p?.nextScanAt ?? null,
          found: p?.opportunitiesFound ?? 0,
          placed: p?.opportunitiesPlaced ?? 0,
          activeTrades,
          paused: json.circuitBreaker?.paused ?? false,
          pauseReason: json.circuitBreaker?.reason ?? null,
          error: p?.phase === "error",
        })
      } catch {
        // Daemon unreachable
      }
    }
    void fetchData()
    const interval = setInterval(fetchData, 15_000)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [])

  return data
}

function formatCountdown(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now()
  if (diff <= 0) return "a moment"
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs} seconds`
  const mins = Math.floor(secs / 60)
  if (mins === 1) return "1 minute"
  if (mins < 60) return `${mins} minutes`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  if (diff < 0) return "just now"
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return "just now"
  const mins = Math.floor(secs / 60)
  if (mins === 1) return "1 minute ago"
  if (mins < 60) return `${mins} minutes ago`
  const hrs = Math.floor(mins / 60)
  if (hrs === 1) return "1 hour ago"
  return `${hrs} hours ago`
}
