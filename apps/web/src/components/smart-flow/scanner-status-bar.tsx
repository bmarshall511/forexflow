"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Radar,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Filter,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type {
  SmartFlowScanProgress,
  SmartFlowScannerCircuitBreakerState,
  SmartFlowScanLogEntry,
} from "@fxflow/types"

interface ScannerStatusBarProps {
  daemonUrl: string
}

interface StatusApiResponse {
  ok: boolean
  progress: SmartFlowScanProgress | null
  circuitBreaker: SmartFlowScannerCircuitBreakerState | null
}

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins === 1) return "1 min ago"
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  return hrs === 1 ? "1 hr ago" : `${hrs} hrs ago`
}

function timeUntil(dateStr: string): string {
  const mins = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 60000)
  if (mins <= 0) return "soon"
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
  const p = progress.phase
  if (p === "scanning" || p === "analyzing" || p === "placing") return "scanning"
  if (p === "idle" || p === "complete" || p === "error") return "idle"
  return "off"
}

const LOG_ICONS: Record<string, { icon: string; color: string }> = {
  opportunity_found: { icon: "✓", color: "text-emerald-500" },
  opportunity_filtered: { icon: "✕", color: "text-amber-500" },
  opportunity_placed: { icon: "⚡", color: "text-teal-500" },
  scan_complete: { icon: "●", color: "text-blue-500" },
  scan_start: { icon: "→", color: "text-muted-foreground" },
  error: { icon: "!", color: "text-red-500" },
}

export function ScannerStatusBar({ daemonUrl }: ScannerStatusBarProps) {
  const [data, setData] = useState<StatusApiResponse | null>(null)
  const [scanLog, setScanLog] = useState<SmartFlowScanLogEntry[]>([])
  const [scanning, setScanning] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, logRes] = await Promise.all([
        fetch(`${daemonUrl}/smart-flow/scanner/status`),
        fetch(`${daemonUrl}/smart-flow/scanner/log`),
      ])
      if (statusRes.ok) setData((await statusRes.json()) as StatusApiResponse)
      if (logRes.ok) {
        const logJson = (await logRes.json()) as { ok: boolean; log: SmartFlowScanLogEntry[] }
        if (logJson.ok) setScanLog(logJson.log)
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
  const hasScanned = progress.lastScanAt != null
  const found = progress.opportunitiesFound
  const placed = progress.opportunitiesPlaced
  const filtered = found - placed

  // Get recent interesting log entries (last scan's results)
  const recentLog = scanLog
    .filter((e) => e.type !== "scan_start")
    .slice(-10)
    .reverse()

  return (
    <div className="space-y-0">
      {/* Main status row */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-4 py-2.5 text-sm"
        role="status"
        aria-label={`Scanner ${label}`}
      >
        <span className="flex items-center gap-1.5">
          <Radar className="text-muted-foreground size-3.5" aria-hidden="true" />
          <span className={`size-2 rounded-full ${dotClass}`} aria-hidden="true" />
          <span className="font-medium">{label}</span>
        </span>

        <span className="text-muted-foreground text-xs">
          {hasScanned ? `Last scan ${timeAgo(progress.lastScanAt!)}` : "No scans yet"}
        </span>
        {progress.nextScanAt && state !== "off" && (
          <span className="text-muted-foreground hidden text-xs sm:inline">
            Next {timeUntil(progress.nextScanAt)}
          </span>
        )}

        {/* Results summary */}
        {hasScanned && (
          <span className="hidden items-center gap-3 text-xs md:flex">
            <span className="text-muted-foreground flex items-center gap-1">
              <TrendingUp className="size-3 text-blue-500" aria-hidden="true" />
              {progress.pairsScanned} pairs
            </span>
            <span
              className={`flex items-center gap-1 ${found > 0 ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
            >
              <CheckCircle2 className="size-3" aria-hidden="true" />
              {found} found
            </span>
            {placed > 0 && (
              <span className="flex items-center gap-1 font-medium text-teal-600 dark:text-teal-400">
                <Radar className="size-3" aria-hidden="true" />
                {placed} placed
              </span>
            )}
            {filtered > 0 && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Filter className="size-3 text-amber-500" aria-hidden="true" />
                {filtered} filtered
              </span>
            )}
          </span>
        )}

        <span className="flex-1" />

        {/* Expand detail button */}
        {recentLog.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Hide scan details" : "Show scan details"}
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            Details
          </Button>
        )}

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

      {/* Expanded scan log detail */}
      {expanded && recentLog.length > 0 && (
        <div className="rounded-b-lg border border-t-0 px-4 py-2">
          <p className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wider">
            Last Scan Results
          </p>
          <div className="space-y-1">
            {recentLog.map((entry) => {
              const style = LOG_ICONS[entry.type] ?? LOG_ICONS.scan_complete!
              return (
                <div key={entry.id} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 shrink-0 font-mono ${style.color}`}>{style.icon}</span>
                  <span className="text-foreground/80">{entry.message}</span>
                  {entry.detail && (
                    <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">
                      {entry.detail}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Mobile-friendly summary when no opportunities */}
      {hasScanned && found === 0 && state === "idle" && !expanded && (
        <p className="text-muted-foreground px-1 py-1 text-xs md:hidden">
          Checked {progress.pairsScanned} pairs — no opportunities this time
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

      {/* Scanning progress */}
      {state === "scanning" && progress.message && (
        <p className="text-muted-foreground animate-pulse px-1 py-1 text-xs">{progress.message}</p>
      )}
    </div>
  )
}
