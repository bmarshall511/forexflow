"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Radar, RefreshCw, AlertTriangle, TrendingUp, Filter, CheckCircle2 } from "lucide-react"
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
  return hrs === 1 ? "in 1 hr" : `in ${hrs} hrs`
}

type DisplayState = "scanning" | "idle" | "paused" | "off"

const STATUS_CONFIG: Record<DisplayState, { label: string; dotClass: string }> = {
  scanning: { label: "Scanning", dotClass: "bg-emerald-500 animate-pulse" },
  idle: { label: "Idle", dotClass: "bg-emerald-500" },
  paused: { label: "Paused", dotClass: "bg-red-500" },
  off: { label: "Off", dotClass: "bg-gray-400" },
}

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
      if (res.ok) setData((await res.json()) as StatusApiResponse)
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
  const hasScanned = progress.lastScanAt != null
  const found = progress.opportunitiesFound
  const placed = progress.opportunitiesPlaced
  const filtered = found - placed

  return (
    <div className="space-y-2">
      {/* Status row */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-4 py-2.5 text-sm"
        role="status"
        aria-label={`Scanner ${label}`}
      >
        {/* Status indicator */}
        <span className="flex items-center gap-1.5">
          <Radar className="text-muted-foreground size-3.5" aria-hidden="true" />
          <span className={`size-2 rounded-full ${dotClass}`} aria-hidden="true" />
          <span className="font-medium">{label}</span>
        </span>

        {/* Timing */}
        <span className="text-muted-foreground text-xs">
          {hasScanned ? `Last scan ${formatTimeDistance(progress.lastScanAt!)}` : "No scans yet"}
        </span>
        {progress.nextScanAt && state !== "off" && (
          <span className="text-muted-foreground hidden text-xs sm:inline">
            Next {formatTimeUntil(progress.nextScanAt)}
          </span>
        )}

        {/* Scan results summary — only show if we've scanned */}
        {hasScanned && (
          <span className="hidden items-center gap-3 text-xs md:flex">
            <span className="flex items-center gap-1">
              <TrendingUp className="size-3 text-blue-500" aria-hidden="true" />
              <span className="text-muted-foreground">{progress.pairsScanned} pairs checked</span>
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2
                className={`size-3 ${found > 0 ? "text-emerald-500" : "text-muted-foreground"}`}
                aria-hidden="true"
              />
              <span
                className={
                  found > 0
                    ? "font-medium text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                }
              >
                {found} found
              </span>
            </span>
            {placed > 0 && (
              <span className="flex items-center gap-1">
                <Radar className="size-3 text-teal-500" aria-hidden="true" />
                <span className="font-medium text-teal-600 dark:text-teal-400">
                  {placed} placed
                </span>
              </span>
            )}
            {filtered > 0 && (
              <span className="flex items-center gap-1">
                <Filter className="size-3 text-amber-500" aria-hidden="true" />
                <span className="text-muted-foreground">{filtered} filtered</span>
              </span>
            )}
          </span>
        )}

        <span className="flex-1" />

        {/* Manual scan button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={triggerScan}
          disabled={scanning || state === "off"}
          aria-label="Scan now"
        >
          <RefreshCw className={`size-3 ${scanning ? "animate-spin" : ""}`} />
          Scan Now
        </Button>
      </div>

      {/* Last scan results detail — mobile-friendly expandable summary */}
      {hasScanned && found === 0 && state === "idle" && (
        <p className="text-muted-foreground px-1 text-xs md:hidden">
          Last scan checked {progress.pairsScanned} pairs — no opportunities found this time.
        </p>
      )}

      {/* Circuit breaker warning */}
      {state === "paused" && cb?.reason && (
        <div
          className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-600 dark:text-amber-400"
          role="alert"
        >
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Trading paused: {cb.reason}
            {cb.consecutiveLosses > 0 && ` (${cb.consecutiveLosses} losses in a row)`}
          </span>
        </div>
      )}

      {/* Scanning progress message */}
      {state === "scanning" && progress.message && (
        <p className="text-muted-foreground animate-pulse px-1 text-xs">{progress.message}</p>
      )}
    </div>
  )
}
