"use client"

import { useMemo, useState, useEffect } from "react"
import { useDaemonConnection } from "./use-daemon-connection"

export interface SidebarStatus {
  /** Primary status line, e.g. "Scanning 5/20..." or "Next scan in 2m" */
  line1: string
  /** Secondary line, e.g. "3 setups · 1 approaching" */
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
      const { isScanning, pairsScanned, totalPairs, lastScanAt, nextScanAt, error } =
        tradeFinderScanStatus

      let line1: string
      let variant: SidebarStatus["variant"] = "default"

      if (error) {
        line1 = "Something went wrong"
        variant = "error"
      } else if (isScanning) {
        line1 = `Checking ${pairsScanned} of ${totalPairs} pairs...`
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
      let line2: string | undefined
      if (total > 0) {
        const parts = [`${total} trade idea${total !== 1 ? "s" : ""} found`]
        if (approaching > 0) parts.push(`${approaching} close to entry`)
        line2 = parts.join(" · ")
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

  // Fetch setup counts on mount and periodically
  useEffect(() => {
    let mounted = true
    const fetchCounts = async () => {
      try {
        const res = await fetch("/api/trade-finder/setups")
        const json = await res.json()
        if (!mounted || !json.ok) return
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
    const interval = setInterval(fetchCounts, 30_000) // Refresh every 30s
    return () => {
      mounted = false
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
  if (diff <= 0) return "now"
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  if (diff < 0) return "just now"
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}
