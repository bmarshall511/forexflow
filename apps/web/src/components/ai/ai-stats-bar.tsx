"use client"

import { useState, useEffect } from "react"
import type { AiUsageStats } from "@fxflow/types"
import { DataTile } from "@/components/ui/data-tile"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, XCircle, Ban, Loader2, DollarSign, Calendar, CalendarDays, CalendarRange, Clock } from "lucide-react"

function fmt(n: number) {
  return n < 0.001 ? "$0.00" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`
}

export function AiStatsBar() {
  const [stats, setStats] = useState<AiUsageStats | null>(null)

  useEffect(() => {
    fetch("/api/ai/usage")
      .then((r) => r.json())
      .then((j: { ok: boolean; data?: AiUsageStats }) => { if (j.ok && j.data) setStats(j.data) })
      .catch(() => {})
  }, [])

  if (!stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Cost tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
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
        <div className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs bg-emerald-500/10 border-emerald-500/20 text-emerald-600">
          <CheckCircle2 className="size-3" />
          <span className="font-medium">{stats.statusCounts.completed}</span>
          <span className="text-emerald-600/70">completed</span>
        </div>
        {stats.statusCounts.running > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs bg-blue-500/10 border-blue-500/20 text-blue-600">
            <Loader2 className="size-3 animate-spin" />
            <span className="font-medium">{stats.statusCounts.running}</span>
            <span className="text-blue-600/70">running</span>
          </div>
        )}
        {stats.statusCounts.pending > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs bg-amber-500/10 border-amber-500/20 text-amber-600">
            <Loader2 className="size-3" />
            <span className="font-medium">{stats.statusCounts.pending}</span>
            <span className="text-amber-600/70">pending</span>
          </div>
        )}
        {stats.statusCounts.failed > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs bg-red-500/10 border-red-500/20 text-red-600">
            <XCircle className="size-3" />
            <span className="font-medium">{stats.statusCounts.failed}</span>
            <span className="text-red-600/70">failed</span>
          </div>
        )}
        {stats.statusCounts.cancelled > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs bg-muted text-muted-foreground">
            <Ban className="size-3" />
            <span className="font-medium">{stats.statusCounts.cancelled}</span>
            <span>cancelled</span>
          </div>
        )}
      </div>
    </div>
  )
}
