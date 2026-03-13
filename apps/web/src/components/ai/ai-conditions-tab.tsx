"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { formatRelativeTime } from "@fxflow/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw, Sparkles, User } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConditionSummary {
  id: string
  tradeId: string
  instrument: string
  direction: string
  triggerType: string
  triggerValue: Record<string, unknown>
  actionType: string
  actionParams: Record<string, unknown>
  status: string
  label: string | null
  createdBy: "user" | "ai"
  triggeredAt: string | null
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTrigger(type: string, value: Record<string, unknown>): string {
  switch (type) {
    case "price_reaches": return `Price reaches ${value.price}`
    case "price_breaks_above": return `Price breaks above ${value.price}`
    case "price_breaks_below": return `Price breaks below ${value.price}`
    case "pnl_pips": return `P&L ${Number(value.pips) > 0 ? "+" : ""}${value.pips} pips`
    case "pnl_currency": return `P&L ${Number(value.amount) > 0 ? "+" : ""}$${value.amount}`
    case "time_reached": return `At ${new Date(value.time as string).toLocaleString()}`
    case "duration_hours": return `After ${value.hours}h`
    case "trailing_stop": {
      const step = value.step_pips ? ` (step: ${value.step_pips})` : ""
      return `Trail ${value.distance_pips} pips${step}`
    }
    default: return type.replace(/_/g, " ")
  }
}

function formatAction(type: string, params: Record<string, unknown>): string {
  switch (type) {
    case "close_trade": return "Close trade"
    case "partial_close": return `Partial close${params.units ? ` ${params.units} units` : ""}`
    case "move_stop_loss": return `Move SL to ${params.price ?? params.stopLoss}`
    case "move_take_profit": return `Move TP to ${params.price ?? params.takeProfit}`
    case "cancel_order": return "Cancel order"
    case "notify": return "Notify"
    default: return type.replace(/_/g, " ")
  }
}

function conditionBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "active": return { label: "Active", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" }
    case "waiting": return { label: "Waiting", className: "bg-zinc-500/15 text-zinc-500 border-zinc-500/30" }
    case "triggered": return { label: "Triggered", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" }
    case "expired": return { label: "Expired", className: "bg-muted text-muted-foreground" }
    case "cancelled": return { label: "Cancelled", className: "bg-muted text-muted-foreground" }
    default: return { label: status, className: "" }
  }
}

// ─── Condition Card ───────────────────────────────────────────────────────────

function ConditionCard({ row, onClick }: { row: ConditionSummary; onClick: () => void }) {
  const badge = conditionBadge(row.status)
  const isLong = row.direction === "long"
  const isActive = row.status === "active"
  const triggerText = row.label ?? formatTrigger(row.triggerType, row.triggerValue)
  const actionText = formatAction(row.actionType, row.actionParams)

  return (
    <button
      type="button"
      className={cn(
        "w-full text-left rounded-lg border border-border/50 px-3 py-2 transition-colors hover:bg-muted/10",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        isActive && "border-l-2 border-l-emerald-500/50",
      )}
      onClick={onClick}
      aria-label={`${row.instrument.replace("_", "/")} condition — ${badge.label}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Instrument + direction */}
        <span className="text-xs font-semibold font-mono shrink-0">
          {row.instrument.replace("_", "/")}
        </span>
        <span className={cn("text-[10px] font-medium shrink-0", isLong ? "text-emerald-600" : "text-red-500")}>
          {isLong ? "↑" : "↓"}
        </span>

        {/* Source badge */}
        <Badge variant="outline" className={cn(
          "text-[10px] h-5 gap-0.5 shrink-0",
          row.createdBy === "ai"
            ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
            : "bg-amber-500/10 text-amber-600 border-amber-500/20",
        )}>
          {row.createdBy === "ai" ? <Sparkles className="size-2.5" /> : <User className="size-2.5" />}
          {row.createdBy === "ai" ? "AI" : "User"}
        </Badge>

        {/* Status badge */}
        <Badge variant="outline" className={cn("text-[10px] h-5 shrink-0", badge.className)}>
          {badge.label}
        </Badge>

        {/* Spacer */}
        <div className="flex-1 min-w-1" />

        {/* Time */}
        <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
          {row.triggeredAt ? formatRelativeTime(row.triggeredAt) : formatRelativeTime(row.createdAt)}
        </span>
      </div>

      {/* Trigger → Action */}
      <div className="mt-1.5 flex items-center gap-2 text-[11px]">
        <span className="text-muted-foreground truncate max-w-[200px]" title={triggerText}>
          {triggerText}
        </span>
        <span className="text-muted-foreground/50 shrink-0" aria-hidden="true">→</span>
        <span className="text-foreground font-medium truncate max-w-[160px]" title={actionText}>
          {actionText}
        </span>
      </div>
    </button>
  )
}

// ─── Conditions Tab ───────────────────────────────────────────────────────────

export function AiConditionsTab() {
  const router = useRouter()
  const [rows, setRows] = useState<ConditionSummary[]>([])
  const [statusFilter, setStatusFilter] = useState("active")
  const [isLoading, setIsLoading] = useState(false)

  const fetchData = useCallback(async (st: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/ai/conditions/all?status=${st}`)
      const json = await res.json() as { ok: boolean; data?: ConditionSummary[] }
      if (json.ok && json.data) setRows(json.data)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData(statusFilter) }, [fetchData, statusFilter])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="triggered">Triggered</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => void fetchData(statusFilter)}>
          <RefreshCw className="size-3.5" />
          <span className="sr-only">Refresh</span>
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} condition{rows.length !== 1 ? "s" : ""}</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No conditions found</p>
      ) : (
        <div className="space-y-1">
          {rows.map((row) => (
            <ConditionCard
              key={row.id}
              row={row}
              onClick={() => router.push(`/positions?tab=${row.status === "triggered" ? "history" : "open"}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
