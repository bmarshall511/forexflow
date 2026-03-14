"use client"

import { useState } from "react"
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
} from "lucide-react"
import { toast } from "sonner"
import { useAiTrader } from "@/hooks/use-ai-trader"
import { ScannerStatusBar } from "./scanner-status-bar"
import { ScanActivityLog } from "./scan-activity-log"

type Tab = "opportunities" | "activity" | "performance"

const statusBadge: Record<string, { label: string; className: string }> = {
  detected: { label: "Detected", className: "bg-blue-500/15 text-blue-500" },
  suggested: { label: "Suggested", className: "bg-amber-500/15 text-amber-500" },
  approved: { label: "Approved", className: "bg-green-500/15 text-green-500" },
  placed: { label: "Placed", className: "bg-purple-500/15 text-purple-500" },
  filled: { label: "Filled", className: "bg-teal-500/15 text-teal-500" },
  managed: { label: "Managing", className: "bg-blue-500/15 text-blue-500" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground" },
  rejected: { label: "Rejected", className: "bg-red-500/15 text-red-500" },
  expired: { label: "Expired", className: "bg-muted text-muted-foreground" },
  skipped: { label: "Skipped", className: "bg-muted text-muted-foreground" },
}

export function AiTraderDashboard() {
  const [tab, setTab] = useState<Tab>("opportunities")
  const [actionInFlight, setActionInFlight] = useState(false)

  const {
    status,
    progress,
    scanLog,
    opportunities,
    isLoading,
    triggerScan,
    pauseScanner,
    resumeScanner,
    handleAction,
  } = useAiTrader()

  const isScanning =
    status?.scanning || (progress && !["complete", "skipped", "error"].includes(progress.phase))
  const isPaused = status?.enabled === false && !isScanning
  const scannerLabel = !status?.enabled
    ? isPaused
      ? "Paused"
      : "Off"
    : isScanning
      ? "Scanning"
      : "Idle"

  const onScanNow = async () => {
    setActionInFlight(true)
    try {
      await triggerScan()
      toast.info("Scan triggered")
    } catch {
      toast.error("Failed to trigger scan")
    } finally {
      setActionInFlight(false)
    }
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

  const onAction = async (id: string, action: "approve" | "reject") => {
    try {
      await handleAction(id, action)
      toast.success(action === "approve" ? "Opportunity approved" : "Opportunity rejected")
    } catch {
      toast.error(`Failed to ${action} opportunity`)
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

  return (
    <div className="min-h-screen">
      <PageHeader
        title="AI Trader"
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

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <DataTile
            label="Scanner"
            value={scannerLabel}
            icon={<Bot className="size-3" />}
            variant={
              isScanning ? "accent" : isPaused ? "muted" : status?.enabled ? "positive" : "muted"
            }
          />
          <DataTile
            label="Open AI Trades"
            value={String(status?.openAiTradeCount ?? 0)}
            icon={<Zap className="size-3" />}
            variant={status?.openAiTradeCount ? "accent" : "default"}
          />
          <DataTile
            label="Today's AI Cost"
            value={`$${(status?.todayBudgetUsed ?? 0).toFixed(4)}`}
            icon={<DollarSign className="size-3" />}
          />
          <DataTile
            label="Monthly AI Cost"
            value={`$${(status?.monthlyBudgetUsed ?? 0).toFixed(4)}`}
            icon={<DollarSign className="size-3" />}
          />
        </div>
      </PageHeader>

      <TabNav label="AI trader sections">
        <TabNavButton
          active={tab === "opportunities"}
          onClick={() => setTab("opportunities")}
          icon={<Zap className="size-3.5" />}
          label="Opportunities"
          count={opportunities.filter((o) => ["suggested", "detected"].includes(o.status)).length}
          pulse={opportunities.some((o) => o.status === "suggested")}
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
          <OpportunityList opportunities={opportunities} onAction={onAction} />
        )}
        {tab === "activity" && <ScanActivityLog entries={scanLog} />}
        {tab === "performance" && (
          <div className="text-muted-foreground py-12 text-center text-sm">
            Performance analytics coming soon
          </div>
        )}
      </div>
    </div>
  )
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

// ─── Opportunity List ──────────────────────────────────────────────────────

function OpportunityList({
  opportunities,
  onAction,
}: {
  opportunities: {
    id: string
    instrument: string
    direction: string
    profile: string
    confidence: number
    entryPrice: number
    stopLoss: number
    takeProfit: number
    status: string
    primaryTechnique?: string | null
    entryRationale?: string | null
  }[]
  onAction: (id: string, action: "approve" | "reject") => void
}) {
  if (opportunities.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center text-sm">
        No opportunities found yet. The AI scanner will discover them on the next cycle.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {opportunities.map((opp) => {
        const badge = statusBadge[opp.status] ?? {
          label: opp.status,
          className: "bg-muted text-muted-foreground",
        }
        return (
          <div key={opp.id} className="border-border/50 bg-card space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{opp.instrument.replace("_", "/")}</span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    opp.direction === "long" ? "text-green-500" : "text-red-500",
                  )}
                >
                  {opp.direction.toUpperCase()}
                </span>
                <span className="text-muted-foreground text-xs capitalize">{opp.profile}</span>
                {opp.primaryTechnique && (
                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
                    {opp.primaryTechnique.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <span
                className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", badge.className)}
              >
                {badge.label}
              </span>
            </div>
            {opp.entryRationale && (
              <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                {opp.entryRationale}
              </p>
            )}
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Confidence</span>
                <p className="font-mono font-semibold">{opp.confidence}%</p>
              </div>
              <div>
                <span className="text-muted-foreground">Entry</span>
                <p className="font-mono">{opp.entryPrice}</p>
              </div>
              <div>
                <span className="text-muted-foreground">SL</span>
                <p className="font-mono text-red-500">{opp.stopLoss}</p>
              </div>
              <div>
                <span className="text-muted-foreground">TP</span>
                <p className="font-mono text-green-500">{opp.takeProfit}</p>
              </div>
            </div>
            {opp.status === "suggested" && (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onAction(opp.id, "approve")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => onAction(opp.id, "reject")}
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
