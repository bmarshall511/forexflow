"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { useDaemonStatus } from "./use-daemon-status"

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
  const { lastAiTraderScanStatus, lastAiTraderScanProgress, tvAlertsStatus } = useDaemonStatus()
  const smartFlowNavData = useSmartFlowNavData()

  return useMemo(() => {
    const result: Record<string, SidebarStatus> = {}

    // ─── SmartFlow status ─────────────────────────────────────────────
    if (smartFlowNavData) {
      const {
        scannerEnabled,
        scanning,
        hasScanHistory,
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

      // Label ladder:
      //   1. error            → "Something went wrong"
      //   2. scanner disabled → "Scanner disabled" (user explicitly turned it off)
      //   3. circuit breaker  → pauseReason
      //   4. scanning now     → "Scanning markets..."
      //   5. countdown        → "Scans again in Xm"
      //   6. last scan        → "Scanned Xm ago"
      //   7. no history yet   → "Starting scanner..."
      //   8. default          → "Ready"
      if (error) {
        line1 = "Something went wrong"
        variant = "error"
      } else if (!scannerEnabled) {
        line1 = "Scanner disabled"
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
      } else if (!hasScanHistory) {
        line1 = "Starting scanner..."
      } else {
        line1 = "Waiting for next scan"
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

    // ─── TV Alerts status ───────────────────────────────────────────
    if (tvAlertsStatus) {
      const {
        enabled,
        cfWorkerConnected,
        activeAutoPositions,
        todayAutoPL,
        circuitBreakerTripped,
        signalCountToday,
        lastSignalAt,
      } = tvAlertsStatus
      let line1: string
      let line2: string | undefined
      let variant: SidebarStatus["variant"] = "default"

      if (circuitBreakerTripped) {
        line1 = "Circuit breaker tripped"
        variant = "error"
      } else if (!enabled) {
        line1 = "Module disabled"
        variant = "default"
      } else if (!cfWorkerConnected) {
        line1 = "CF Worker disconnected"
        variant = "warning"
      } else if (lastSignalAt) {
        line1 = `Last signal ${formatTimeAgo(lastSignalAt)}`
        variant = "active"
      } else {
        line1 = "Waiting for signals"
        variant = "active"
      }

      // Line 2: positions + P&L or signal count
      if (activeAutoPositions > 0) {
        const plStr =
          todayAutoPL !== 0 ? ` · ${todayAutoPL >= 0 ? "+" : ""}$${todayAutoPL.toFixed(0)}` : ""
        line2 = `${activeAutoPositions} position${activeAutoPositions !== 1 ? "s" : ""} open${plStr}`
      } else if (signalCountToday > 0) {
        const plStr =
          todayAutoPL !== 0 ? ` · P&L ${todayAutoPL >= 0 ? "+" : ""}$${todayAutoPL.toFixed(0)}` : ""
        line2 = `${signalCountToday} signal${signalCountToday !== 1 ? "s" : ""} today${plStr}`
      } else if (enabled && cfWorkerConnected) {
        line2 = "No signals today"
      }

      result.tvAlerts = { line1, line2, variant }
    }

    return result
  }, [
    smartFlowNavData,
    tradeFinderScanStatus,
    tradeFinderSetupCounts,
    lastAiTraderScanStatus,
    lastAiTraderScanProgress,
    tvAlertsStatus,
  ])
}

/** Gathers Trade Finder data needed for the sidebar nav status. */
function useTradeFinderNavData() {
  const { tradeFinderScanStatus } = useDaemonStatus()
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
    /**
     * User-configured scanner toggle from `SmartFlowSettings.scannerEnabled`.
     * Distinct from transient scan activity — the scanner can be enabled
     * and simply idle between scan cycles.
     */
    scannerEnabled: boolean
    /** Whether the scanner is actively working right now. */
    scanning: boolean
    /** Whether we have ever received scan progress data from the daemon. */
    hasScanHistory: boolean
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
        // Pull scanner runtime state, user-configured settings, and active
        // trade count in parallel. User settings are the source of truth for
        // "is the scanner enabled" — the runtime status only tells us what
        // the scanner is doing RIGHT NOW (which is often "idle between scans"
        // even when the user has it turned on).
        const [runtimeRes, settingsRes, tradesRes] = await Promise.all([
          fetch("/api/daemon/smart-flow/scanner/status"),
          fetch("/api/smart-flow/settings"),
          fetch("/api/smart-flow/trades"),
        ])
        if (!mountedRef.current) return

        type RuntimeProgress = {
          phase: string
          lastScanAt: string | null
          nextScanAt: string | null
          opportunitiesFound: number
          opportunitiesPlaced: number
        }
        type RuntimeCircuitBreaker = { paused: boolean; reason: string | null }
        let progress: RuntimeProgress | null = null
        let circuitBreaker: RuntimeCircuitBreaker | null = null
        if (runtimeRes.ok) {
          const json = (await runtimeRes.json()) as {
            ok: boolean
            progress: RuntimeProgress | null
            circuitBreaker: RuntimeCircuitBreaker | null
          }
          if (json.ok) {
            progress = json.progress
            circuitBreaker = json.circuitBreaker
          }
        }

        let userEnabled = false
        if (settingsRes.ok) {
          const json = (await settingsRes.json()) as {
            ok: boolean
            data?: { scannerEnabled?: boolean }
          }
          if (json.ok && json.data?.scannerEnabled != null) {
            userEnabled = json.data.scannerEnabled
          }
        }

        let activeTrades = 0
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

        if (!mountedRef.current) return
        const p = progress
        const scanning =
          p?.phase === "scanning" || p?.phase === "analyzing" || p?.phase === "placing"
        setData({
          scannerEnabled: userEnabled,
          scanning: scanning ?? false,
          hasScanHistory: p != null,
          lastScanAt: p?.lastScanAt ?? null,
          nextScanAt: p?.nextScanAt ?? null,
          found: p?.opportunitiesFound ?? 0,
          placed: p?.opportunitiesPlaced ?? 0,
          activeTrades,
          paused: circuitBreaker?.paused ?? false,
          pauseReason: circuitBreaker?.reason ?? null,
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
