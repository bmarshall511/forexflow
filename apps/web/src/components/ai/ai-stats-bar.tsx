"use client"

import { useState, useEffect, useCallback } from "react"
import type { AiUsageStats } from "@fxflow/types"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { DataTile } from "@/components/ui/data-tile"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CheckCircle2,
  XCircle,
  Ban,
  Loader2,
  DollarSign,
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock,
  AlertTriangle,
} from "lucide-react"

function fmt(n: number) {
  return n < 0.001 ? "$0.00" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`
}

export function AiStatsBar({ refreshKey }: { refreshKey?: number }) {
  const [stats, setStats] = useState<AiUsageStats | null>(null)
  const { lastAiAnalysisStarted, lastAiAnalysisCompleted } = useDaemonStatus()

  const fetchStats = useCallback(() => {
    fetch("/api/ai/usage")
      .then((r) => r.json())
      .then((j: { ok: boolean; data?: AiUsageStats }) => {
        if (j.ok && j.data) setStats(j.data)
      })
      .catch(() => {})
  }, [])

  // Fetch on mount and when refreshKey changes (e.g. after reset-stuck)
  useEffect(() => {
    fetchStats()
  }, [fetchStats, refreshKey])

  // Refetch when analyses start or complete (real-time via WS)
  useEffect(() => {
    if (lastAiAnalysisStarted) fetchStats()
  }, [lastAiAnalysisStarted, fetchStats])

  useEffect(() => {
    if (lastAiAnalysisCompleted) fetchStats()
  }, [lastAiAnalysisCompleted, fetchStats])

  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Cost tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <DataTile
          label="Today"
          value={fmt(stats.byPeriod.today.costUsd)}
          subtitle={`${stats.byPeriod.today.count} analyses`}
          icon={<Clock className="size-3.5" />}
          variant="accent"
        />
        <DataTile
          label="This Week"
          value={fmt(stats.byPeriod.thisWeek.costUsd)}
          subtitle={`${stats.byPeriod.thisWeek.count} analyses`}
          icon={<Calendar className="size-3.5" />}
        />
        <DataTile
          label="This Month"
          value={fmt(stats.byPeriod.thisMonth.costUsd)}
          subtitle={`${stats.byPeriod.thisMonth.count} analyses`}
          icon={<CalendarDays className="size-3.5" />}
        />
        <DataTile
          label="This Year"
          value={fmt(stats.byPeriod.thisYear.costUsd)}
          subtitle={`${stats.byPeriod.thisYear.count} analyses`}
          icon={<CalendarRange className="size-3.5" />}
        />
        <DataTile
          label="All Time"
          value={fmt(stats.totalCostUsd)}
          subtitle={`${stats.totalAnalyses} analyses`}
          icon={<DollarSign className="size-3.5" />}
        />
      </div>

      {/* Status count pills */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-600">
          <CheckCircle2 className="size-3" />
          <span className="font-medium">{stats.statusCounts.completed}</span>
          <span className="text-emerald-600/70">completed</span>
        </div>
        {stats.statusCounts.running > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-600">
            <Loader2 className="size-3 animate-spin" />
            <span className="font-medium">{stats.statusCounts.running}</span>
            <span className="text-blue-600/70">running</span>
          </div>
        )}
        {stats.statusCounts.pending > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-600">
            <Loader2 className="size-3" />
            <span className="font-medium">{stats.statusCounts.pending}</span>
            <span className="text-amber-600/70">pending</span>
          </div>
        )}
        {stats.statusCounts.partial > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-600">
            <AlertTriangle className="size-3" />
            <span className="font-medium">{stats.statusCounts.partial}</span>
            <span className="text-amber-600/70">partial</span>
          </div>
        )}
        {stats.statusCounts.failed > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-600">
            <XCircle className="size-3" />
            <span className="font-medium">{stats.statusCounts.failed}</span>
            <span className="text-red-600/70">failed</span>
          </div>
        )}
        {stats.statusCounts.cancelled > 0 && (
          <div className="bg-muted text-muted-foreground flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
            <Ban className="size-3" />
            <span className="font-medium">{stats.statusCounts.cancelled}</span>
            <span>cancelled</span>
          </div>
        )}
      </div>
    </div>
  )
}
