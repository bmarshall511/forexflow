"use client"

import type { AiTraderScanStatus, AiTraderScanProgressData } from "@fxflow/types"
import { cn } from "@/lib/utils"
import { Bot, Clock, AlertCircle } from "lucide-react"

interface ScannerStatusBarProps {
  status: AiTraderScanStatus | null
  progress: AiTraderScanProgressData | null
}

const PHASE_LABELS: Record<string, string> = {
  starting: "Getting ready...",
  checking_config: "Checking your settings...",
  checking_market: "Checking if markets are open...",
  checking_budget: "Checking AI spending budget...",
  scanning_pairs: "Looking for trading opportunities...",
  analyzing_candidates: "AI is analyzing potential trades...",
  complete: "Scan complete",
  skipped: "Scan skipped",
  error: "Scan error",
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

function formatCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return "now"
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `in ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `in ${minutes}m`
}

export function ScannerStatusBar({ status, progress }: ScannerStatusBarProps) {
  const isScanning =
    (status?.scanning ?? false) ||
    (progress != null && !["complete", "skipped", "error"].includes(progress.phase))
  const isEnabled = status?.enabled ?? false
  const hasError = !!status?.error

  // Determine display state
  let stateLabel: string
  let stateColor: string
  let icon: React.ReactNode

  if (!status) {
    stateLabel = "Connecting..."
    stateColor = "text-muted-foreground"
    icon = <Bot className="text-muted-foreground size-4 animate-pulse" />
  } else if (!isEnabled) {
    stateLabel = "Scanner Off"
    stateColor = "text-muted-foreground"
    icon = <Bot className="text-muted-foreground size-4" />
  } else if (status.paused) {
    stateLabel = "Paused"
    stateColor = "text-amber-500"
    icon = <Bot className="size-4 text-amber-500" />
  } else if (hasError) {
    stateLabel = "Error"
    stateColor = "text-red-500"
    icon = <AlertCircle className="size-4 text-red-500" />
  } else if (isScanning) {
    stateLabel = "Scanning"
    stateColor = "text-blue-500"
    icon = <Bot className="size-4 animate-pulse text-blue-500" />
  } else {
    stateLabel = "Idle"
    stateColor = "text-emerald-500"
    icon = <Bot className="size-4 text-emerald-500" />
  }

  // Progress bar percentage
  const progressPercent =
    isScanning && progress
      ? progress.phase === "scanning_pairs" && progress.pairsTotal > 0
        ? Math.round((progress.pairsScanned / progress.pairsTotal) * 100)
        : progress.phase === "analyzing_candidates" && progress.candidatesTotal > 0
          ? Math.round((progress.candidatesAnalyzed / progress.candidatesTotal) * 100)
          : progress.phase === "complete"
            ? 100
            : 5
      : 0

  return (
    <div className="border-border/50 bg-card space-y-3 rounded-lg border p-4">
      {/* Status row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icon}
          <div>
            <span className={cn("text-sm font-semibold", stateColor)}>{stateLabel}</span>
            {isScanning && progress && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                {PHASE_LABELS[progress.phase] ?? progress.message}
              </p>
            )}
            {!isScanning && status?.error && (
              <p className="mt-0.5 text-xs text-red-500/80">{status.error}</p>
            )}
          </div>
        </div>
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          {status?.lastScanAt && (
            <div className="flex items-center gap-1">
              <Clock className="size-3" />
              <span>Last: {formatTimeAgo(status.lastScanAt)}</span>
            </div>
          )}
          {!isScanning && status?.nextScanAt && (
            <div className="flex items-center gap-1">
              <Clock className="size-3" />
              <span>Scans again {formatCountdown(status.nextScanAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar (only when scanning) */}
      {isScanning && (
        <div className="space-y-1.5">
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progress && (
            <div className="text-muted-foreground flex justify-between text-[10px]">
              <span>{progress.message}</span>
              <span>
                {progress.phase === "scanning_pairs" && progress.pairsTotal > 0
                  ? `${progress.pairsScanned}/${progress.pairsTotal} pairs`
                  : progress.phase === "analyzing_candidates" && progress.candidatesTotal > 0
                    ? `${progress.candidatesAnalyzed}/${progress.candidatesTotal} candidates`
                    : `${Math.round(progress.elapsedMs / 1000)}s`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Last scan summary (when idle, no error) */}
      {!isScanning && isEnabled && !hasError && status?.lastScanAt && (
        <p className="text-muted-foreground text-xs">
          Scanner is monitoring{" "}
          {status.candidateCount > 0
            ? `${status.candidateCount} opportunity${status.candidateCount !== 1 ? "es" : ""}`
            : "the market"}{" "}
          — next scan {status.nextScanAt ? formatCountdown(status.nextScanAt) : "soon"}.
        </p>
      )}
    </div>
  )
}
