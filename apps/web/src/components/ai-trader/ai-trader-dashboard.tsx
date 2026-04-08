"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DataTile } from "@/components/ui/data-tile"
import { TabNav, TabNavButton } from "@/components/ui/tab-nav"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"
import {
  RefreshCw,
  Settings,
  Bot,
  Zap,
  DollarSign,
  BarChart3,
  ScrollText,
  Pause,
  Play,
  AlertTriangle,
  Shield,
} from "lucide-react"
import { toast } from "sonner"
import { useAiTrader } from "@/hooks/use-ai-trader"
import { ScannerStatusBar } from "./scanner-status-bar"
import { ScanActivityLog } from "./scan-activity-log"
import { OpportunityList } from "./opportunity-list"
import { PerformanceTab } from "./performance/performance-tab"

type Tab = "opportunities" | "activity" | "performance"

export function AiTraderDashboard() {
  const [tab, setTab] = useState<Tab>("opportunities")
  const [actionInFlight, setActionInFlight] = useState(false)

  const {
    status,
    progress,
    scanLog,
    opportunities,
    operatingMode,
    confidenceThreshold,
    dailyBudgetUsd,
    monthlyBudgetUsd,
    isLoading,
    triggerScan,
    pauseScanner,
    resumeScanner,
    handleAction,
  } = useAiTrader()

  const isScanning =
    status?.scanning || (progress && !["complete", "skipped", "error"].includes(progress.phase))
  const isPaused = status?.paused === true || (status?.enabled === false && !isScanning)

  // Clear actionInFlight once scanner state catches up via WS
  const prevScanningRef = useRef(false)
  if (isScanning && actionInFlight) {
    setActionInFlight(false)
  }
  // Also clear if scan completes while actionInFlight is still set (e.g. scan was very fast)
  if (prevScanningRef.current && !isScanning && actionInFlight) {
    setActionInFlight(false)
  }
  prevScanningRef.current = !!isScanning
  const onScanNow = async () => {
    setActionInFlight(true)
    setTab("activity")
    try {
      await triggerScan()
    } catch {
      toast.error("Failed to trigger scan")
      setActionInFlight(false)
    }
    // actionInFlight stays true — cleared when isScanning becomes true via WS
  }

  const onPause = async () => {
    setActionInFlight(true)
    try {
      await pauseScanner()
      toast.info("Scanner paused")
    } catch {
      toast.error("Failed to pause scanner")
    } finally {
      setActionInFlight(false)
    }
  }

  const onResume = async () => {
    setActionInFlight(true)
    try {
      await resumeScanner()
      toast.info("Scanner resumed")
    } catch {
      toast.error("Failed to resume scanner")
    } finally {
      setActionInFlight(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="space-y-6 border-b px-4 pb-8 pt-6 md:px-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </div>
      </div>
    )
  }

  const suggestedCount = opportunities.filter((o) =>
    ["suggested", "detected"].includes(o.status),
  ).length

  return (
    <div className="min-h-screen">
      <PageHeader
        title="EdgeFinder"
        subtitle="AI-powered trade discovery and execution"
        icon={Bot}
        bordered
        actions={
          <>
            <ScanControlButtons
              isScanning={!!isScanning}
              isPaused={isPaused}
              disabled={actionInFlight}
              onScan={onScanNow}
              onPause={onPause}
              onResume={onResume}
            />
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" asChild>
              <Link href="/settings/ai-trader">
                <Settings className="size-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            </Button>
          </>
        }
      >
        <ScannerStatusBar status={status} progress={progress} />

        {status?.error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-500">
            <AlertTriangle className="size-4 shrink-0" />
            <span className="truncate">{status.error}</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <DataTile
            label="Scanner"
            value={isScanning ? "Scanning" : isPaused ? "Paused" : status?.enabled ? "Idle" : "Off"}
            subtitle={
              isScanning && progress
                ? progress.phase === "scanning_pairs" && progress.pairsTotal > 0
                  ? `${progress.pairsScanned}/${progress.pairsTotal} pairs checked`
                  : progress.phase === "analyzing_candidates"
                    ? `AI analyzing ${progress.candidatesAnalyzed}/${progress.candidatesTotal}`
                    : "Starting..."
                : status?.lastScanAt
                  ? `Last scan ${formatTimeAgo(status.lastScanAt)}`
                  : undefined
            }
            icon={<Bot className="size-3" />}
            variant={isScanning ? "accent" : status?.error ? "negative" : "default"}
          />
          <DataTile
            label="Opportunities"
            value={String(suggestedCount)}
            subtitle={
              suggestedCount > 0
                ? `${suggestedCount} awaiting review`
                : opportunities.length > 0
                  ? `${opportunities.length} total history`
                  : "None found yet"
            }
            icon={<Zap className="size-3" />}
            variant={suggestedCount > 0 ? "accent" : "default"}
          />
          <DataTile
            label="Mode"
            value={
              operatingMode === "full_auto"
                ? "Full Auto"
                : operatingMode === "semi_auto"
                  ? "Semi-Auto"
                  : "Manual"
            }
            subtitle={
              operatingMode === "manual"
                ? "You approve each trade"
                : `Auto above ${confidenceThreshold}% confidence`
            }
            icon={<Shield className="size-3" />}
          />
          <DataTile
            label="AI Budget"
            value={`$${(status?.todayBudgetUsed ?? 0).toFixed(2)}`}
            subtitle={
              dailyBudgetUsd > 0
                ? `of $${dailyBudgetUsd.toFixed(2)} daily · $${(status?.monthlyBudgetUsed ?? 0).toFixed(2)}/$${monthlyBudgetUsd.toFixed(2)} mo`
                : undefined
            }
            icon={<DollarSign className="size-3" />}
          />
        </div>
      </PageHeader>

      <TabNav label="EdgeFinder sections">
        <TabNavButton
          active={tab === "opportunities"}
          onClick={() => setTab("opportunities")}
          icon={<Zap className="size-3.5" />}
          label="Opportunities"
          count={suggestedCount}
          pulse={suggestedCount > 0}
        />
        <TabNavButton
          active={tab === "activity"}
          onClick={() => setTab("activity")}
          icon={<ScrollText className="size-3.5" />}
          label="Activity"
          count={scanLog.length}
        />
        <TabNavButton
          active={tab === "performance"}
          onClick={() => setTab("performance")}
          icon={<BarChart3 className="size-3.5" />}
          label="Performance"
          count={0}
        />
      </TabNav>

      <div className="space-y-4 px-4 py-6 md:px-6">
        {tab === "opportunities" && (
          <OpportunityList
            operatingMode={operatingMode}
            confidenceThreshold={confidenceThreshold}
            onAction={handleAction}
          />
        )}
        {tab === "activity" && <ScanActivityLog entries={scanLog} />}
        {tab === "performance" && <PerformanceTab />}
      </div>
    </div>
  )
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return "just now"
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

// ─── Scan Control Buttons ──────────────────────────────────────────────────

function ScanControlButtons({
  isScanning,
  isPaused,
  disabled,
  onScan,
  onPause,
  onResume,
}: {
  isScanning: boolean
  isPaused: boolean
  disabled: boolean
  onScan: () => void
  onPause: () => void
  onResume: () => void
}) {
  if (isPaused) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={onResume}
        disabled={disabled}
      >
        <Play className="size-3.5" /> Resume
      </Button>
    )
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => void onScan()}
        disabled={isScanning || disabled}
      >
        <RefreshCw className={cn("size-3.5", isScanning && "animate-spin")} />
        {isScanning ? "Scanning..." : "Scan Now"}
      </Button>
      {!isScanning && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-8 gap-1.5 text-xs"
          onClick={onPause}
          disabled={disabled}
        >
          <Pause className="size-3.5" />
          <span className="hidden sm:inline">Pause</span>
        </Button>
      )}
    </>
  )
}
