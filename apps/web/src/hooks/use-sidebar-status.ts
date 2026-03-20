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

  return useMemo(() => {
    const result: Record<string, SidebarStatus> = {}

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
        line2 = approaching > 0
          ? `${total} found, ${approaching} close to entry`
          : `${total} trade idea${total !== 1 ? "s" : ""} found`
      } else if (!isScanning && !error) {
        line2 = "No trade ideas right now"
      }

      result.tradeFinder = { line1, line2, variant }
    }

    return result
  }, [tradeFinderScanStatus, tradeFinderSetupCounts])
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
