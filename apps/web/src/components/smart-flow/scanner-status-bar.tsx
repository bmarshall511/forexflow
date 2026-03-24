"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Radar, RefreshCw, AlertTriangle } from "lucide-react"
import type { SmartFlowScanProgress, SmartFlowScannerCircuitBreakerState } from "@fxflow/types"

interface ScannerStatusBarProps {
  daemonUrl: string
}

interface StatusApiResponse {
  ok: boolean
  progress: SmartFlowScanProgress | null
  circuitBreaker: SmartFlowScannerCircuitBreakerState | null
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

type DisplayState = "scanning" | "idle" | "paused" | "off"

const STATUS_CONFIG: Record<DisplayState, { label: string; dotClass: string }> = {
  scanning: { label: "Scanning", dotClass: "bg-emerald-500" },
  idle: { label: "Idle", dotClass: "bg-amber-500" },
  paused: { label: "Paused", dotClass: "bg-red-500" },
  off: { label: "Off", dotClass: "bg-gray-400" },
}

/** Map the daemon's scan progress phase to a simple display state. */
function resolveState(
  progress: SmartFlowScanProgress | null,
  cb: SmartFlowScannerCircuitBreakerState | null,
): DisplayState {
  if (!progress) return "off"
  if (cb?.paused) return "paused"
  if (
    progress.phase === "scanning" ||
    progress.phase === "analyzing" ||
    progress.phase === "placing"
  )
    return "scanning"
  if (progress.phase === "idle" || progress.phase === "complete") return "idle"
  if (progress.phase === "error") return "idle"
  return "off"
}

export function ScannerStatusBar({ daemonUrl }: ScannerStatusBarProps) {
  const [data, setData] = useState<StatusApiResponse | null>(null)
  const [scanning, setScanning] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${daemonUrl}/smart-flow/scanner/status`)
      if (res.ok) {
        const json = (await res.json()) as StatusApiResponse
        setData(json)
      }
    } catch {
      /* daemon unreachable */
    }
  }, [daemonUrl])

  useEffect(() => {
    void fetchStatus()
    const id = setInterval(() => void fetchStatus(), 15_000)
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

  if (!data?.progress) return null

  const progress = data.progress
  const cb = data.circuitBreaker
  const state = resolveState(progress, cb)
  const { label, dotClass } = STATUS_CONFIG[state]

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
          Last scan: {progress.lastScanAt ? formatTimeDistance(progress.lastScanAt) : "Never"}
        </span>

        {progress.nextScanAt && state !== "off" && (
          <span className="text-muted-foreground hidden sm:inline" aria-label="Next scan time">
            Next {formatTimeUntil(progress.nextScanAt)}
          </span>
        )}

        {progress.opportunitiesFound > 0 && (
          <span
            className="text-muted-foreground hidden md:inline"
            aria-label="Last scan statistics"
          >
            Found: {progress.opportunitiesFound} | Placed: {progress.opportunitiesPlaced}
          </span>
        )}

        <span className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={triggerScan}
          disabled={scanning || state === "off"}
          aria-label="Trigger manual scan"
        >
          <RefreshCw className={`size-3 ${scanning ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Scan</span>
        </Button>
      </div>

      {state === "paused" && cb?.reason && (
        <div
          className="flex items-center gap-2 rounded-b-lg border border-t-0 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-600 dark:text-amber-400"
          role="alert"
        >
          <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
          <span>Circuit breaker: {cb.reason}</span>
        </div>
      )}
    </div>
  )
}
