"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Radar, RefreshCw, AlertTriangle } from "lucide-react"

interface ScannerStatus {
  state: "scanning" | "idle" | "paused" | "off"
  lastScanAt: string | null
  nextScanAt: string | null
  lastScanStats: { found: number; placed: number; filtered: number } | null
  circuitBreakerReason: string | null
}

interface ScannerStatusBarProps {
  daemonUrl: string
}

function formatTimeDistance(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins === 1) return "1 min ago"
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs === 1) return "1 hr ago"
  return `${hrs} hrs ago`
}

function formatTimeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return "soon"
  const mins = Math.ceil(diff / 60000)
  if (mins === 1) return "in 1 min"
  if (mins < 60) return `in ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs === 1) return "in 1 hr"
  return `in ${hrs} hrs`
}

const STATUS_CONFIG = {
  scanning: { label: "Scanning", dotClass: "bg-emerald-500" },
  idle: { label: "Idle", dotClass: "bg-amber-500" },
  paused: { label: "Paused", dotClass: "bg-red-500" },
  off: { label: "Off", dotClass: "bg-gray-400" },
} as const

export function ScannerStatusBar({ daemonUrl }: ScannerStatusBarProps) {
  const [status, setStatus] = useState<ScannerStatus | null>(null)
  const [scanning, setScanning] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${daemonUrl}/smart-flow/scanner/status`)
      if (res.ok) setStatus(await res.json())
    } catch {
      /* daemon unreachable */
    }
  }, [daemonUrl])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, 15_000)
    return () => clearInterval(id)
  }, [fetchStatus])

  useEffect(() => {
    const handler = () => void fetchStatus()
    window.addEventListener("smart_flow_scan_progress", handler)
    return () => window.removeEventListener("smart_flow_scan_progress", handler)
  }, [fetchStatus])

  const triggerScan = async () => {
    setScanning(true)
    try {
      await fetch(`${daemonUrl}/smart-flow/scanner/scan`, { method: "POST" })
      await fetchStatus()
    } catch {
      /* ignore */
    } finally {
      setScanning(false)
    }
  }

  if (!status) return null

  const { label, dotClass } = STATUS_CONFIG[status.state]
  const stats = status.lastScanStats

  return (
    <div className="space-y-0">
      <div
        className="flex items-center gap-3 rounded-lg border px-4 py-2 text-sm"
        role="status"
        aria-label={`Scanner ${label}`}
      >
        <span className="flex items-center gap-1.5">
          <Radar className="text-muted-foreground size-3" aria-hidden="true" />
          <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
          <span className="font-medium">{label}</span>
        </span>

        <span className="text-muted-foreground" aria-label="Last scan time">
          Last scan: {status.lastScanAt ? formatTimeDistance(status.lastScanAt) : "Never"}
        </span>

        {status.nextScanAt && status.state !== "off" && (
          <span className="text-muted-foreground hidden sm:inline" aria-label="Next scan time">
            Next {formatTimeUntil(status.nextScanAt)}
          </span>
        )}

        {stats && (
          <span
            className="text-muted-foreground hidden md:inline"
            aria-label="Last scan statistics"
          >
            Found: {stats.found} | Placed: {stats.placed} | Filtered: {stats.filtered}
          </span>
        )}

        <span className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={triggerScan}
          disabled={scanning || status.state === "off"}
          aria-label="Trigger manual scan"
        >
          <RefreshCw className={`size-3 ${scanning ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Scan</span>
        </Button>
      </div>

      {status.state === "paused" && status.circuitBreakerReason && (
        <div
          className="flex items-center gap-2 rounded-b-lg border border-t-0 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-600 dark:text-amber-400"
          role="alert"
        >
          <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
          <span>Circuit breaker: {status.circuitBreakerReason}</span>
        </div>
      )}
    </div>
  )
}
