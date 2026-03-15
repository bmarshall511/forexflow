"use client"

import { useState, useEffect, useCallback } from "react"
import type {
  AiAnalysisData,
  AiAnalysisSections,
  TradeDetailData,
  PendingOrderData,
  OpenTradeData,
  ClosedTradeData,
  TradeSource,
  TradeDirection,
  OrderType,
  TradeCloseReason,
  TradeOutcome,
} from "@fxflow/types"
import { AI_MODEL_OPTIONS, ANALYSIS_STALE_THRESHOLD_MS } from "@fxflow/types"
import { formatRelativeTime, getDecimalPlaces } from "@fxflow/shared"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bot,
  User,
  AlertTriangle,
  Trash2,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AnalysisResults } from "@/components/ai/analysis-results"
import { TradeDetailDrawer } from "@/components/positions/trade-detail-drawer"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

type TradeUnion =
  | (PendingOrderData & { _type: "pending" })
  | (OpenTradeData & { _type: "open" })
  | (ClosedTradeData & { _type: "closed" })

interface AnalysisSummary {
  id: string
  tradeId: string
  instrument: string
  direction: string
  entryPrice: number
  openedAt: string
  tradeNotes: string | null
  status: string
  tradeStatus: string
  depth: string
  model: string
  triggeredBy: string
  winProbability: number | null
  tradeQualityScore: number | null
  costUsd: number
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tradeDetailToUnion(d: TradeDetailData): TradeUnion {
  if (d.status === "pending") {
    return {
      _type: "pending",
      id: d.id,
      source: d.source as TradeSource,
      sourceOrderId: d.sourceTradeId,
      instrument: d.instrument,
      direction: d.direction as TradeDirection,
      orderType: (d.orderType ?? "LIMIT") as OrderType,
      units: d.initialUnits,
      entryPrice: d.entryPrice,
      stopLoss: d.stopLoss,
      takeProfit: d.takeProfit,
      trailingStopDistance: d.trailingStopDistance,
      timeInForce: (d.timeInForce ?? "GTC") as "GTC" | "GTD" | "GFD" | "FOK" | "IOC",
      gtdTime: d.gtdTime,
      timeframe: d.timeframe,
      notes: d.notes ?? null,
      tags: d.tags,
      createdAt: d.openedAt,
    }
  }
  if (d.status === "open") {
    return {
      _type: "open",
      id: d.id,
      source: d.source as TradeSource,
      sourceTradeId: d.sourceTradeId,
      instrument: d.instrument,
      direction: d.direction as TradeDirection,
      entryPrice: d.entryPrice,
      currentPrice: null,
      stopLoss: d.stopLoss,
      takeProfit: d.takeProfit,
      trailingStopDistance: d.trailingStopDistance,
      initialUnits: d.initialUnits,
      currentUnits: d.currentUnits,
      unrealizedPL: d.unrealizedPL,
      realizedPL: d.realizedPL,
      financing: d.financing,
      marginUsed: 0,
      mfe: d.mfe,
      mae: d.mae,
      timeframe: d.timeframe,
      notes: d.notes ?? null,
      tags: d.tags,
      openedAt: d.openedAt,
    }
  }
  return {
    _type: "closed",
    id: d.id,
    source: d.source as TradeSource,
    sourceTradeId: d.sourceTradeId,
    instrument: d.instrument,
    direction: d.direction as TradeDirection,
    entryPrice: d.entryPrice,
    exitPrice: d.exitPrice,
    stopLoss: d.stopLoss,
    takeProfit: d.takeProfit,
    units: d.initialUnits,
    realizedPL: d.realizedPL,
    financing: d.financing,
    closeReason: (d.closeReason ?? "UNKNOWN") as TradeCloseReason,
    outcome: (d.realizedPL > 0 ? "win" : d.realizedPL < 0 ? "loss" : "breakeven") as TradeOutcome,
    mfe: d.mfe,
    mae: d.mae,
    timeframe: d.timeframe,
    notes: d.notes ?? null,
    tags: d.tags,
    openedAt: d.openedAt,
    closedAt: d.closedAt ?? d.openedAt,
  }
}

function modelLabel(modelId: string): string {
  const opt = AI_MODEL_OPTIONS.find((m) => m.id === modelId)
  if (!opt) return modelId
  const parts = opt.name.split(" ")
  return parts[0] ?? opt.name
}

function modelBadgeColor(modelId: string): string {
  if (modelId.includes("haiku")) return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
  if (modelId.includes("sonnet")) return "bg-blue-500/15 text-blue-600 border-blue-500/30"
  if (modelId.includes("opus")) return "bg-purple-500/15 text-purple-600 border-purple-500/30"
  return ""
}

function depthBadgeColor(depth: string): string {
  if (depth === "quick") return "bg-muted text-muted-foreground"
  if (depth === "standard") return "bg-blue-500/10 text-blue-600 border-blue-500/20"
  if (depth === "deep") return "bg-purple-500/10 text-purple-600 border-purple-500/20"
  return ""
}

function analysisBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "completed":
      return {
        label: "Done",
        className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
      }
    case "running":
      return { label: "Running", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" }
    case "pending":
      return { label: "Pending", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" }
    case "failed":
      return { label: "Failed", className: "bg-red-500/15 text-red-600 border-red-500/30" }
    case "cancelled":
      return { label: "Cancelled", className: "bg-muted text-muted-foreground" }
    default:
      return { label: status, className: "" }
  }
}

const AUTO_TRIGGERED_VALUES = new Set(["auto_pending", "auto_fill", "auto_close", "auto_interval"])

function triggeredByLabel(triggeredBy: string): string {
  switch (triggeredBy) {
    case "auto_fill":
      return "On Open"
    case "auto_close":
      return "On Closed"
    case "auto_pending":
      return "On Limit Placed"
    case "auto_interval":
      return "Interval"
    case "user":
      return "Manual"
    default:
      return triggeredBy
  }
}

function triggeredByBadgeClass(triggeredBy: string): string {
  if (!AUTO_TRIGGERED_VALUES.has(triggeredBy)) {
    return "bg-amber-500/10 text-amber-600 border-amber-500/20"
  }
  switch (triggeredBy) {
    case "auto_fill":
      return "bg-purple-500/10 text-purple-600 border-purple-500/20"
    case "auto_close":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20"
    case "auto_pending":
      return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
    case "auto_interval":
      return "bg-violet-500/10 text-violet-600 border-violet-500/20"
    default:
      return "bg-purple-500/10 text-purple-600 border-purple-500/20"
  }
}

function tradeTitle(
  row: Pick<AnalysisSummary, "instrument" | "entryPrice" | "openedAt" | "tradeNotes">,
): string {
  if (row.tradeNotes?.trim()) return row.tradeNotes.trim()
  const decimals = getDecimalPlaces(row.instrument)
  const date = new Date(row.openedAt)
  const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  return `@ ${row.entryPrice.toFixed(decimals)} · ${dateStr}`
}

// ─── Win probability bar ──────────────────────────────────────────────────────

function WinProbBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-[10px]">—</span>
  const color =
    value >= 60
      ? "bg-status-connected"
      : value >= 40
        ? "bg-status-warning"
        : "bg-status-disconnected"

  return (
    <div className="flex min-w-[80px] items-center gap-1.5">
      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-all duration-300", color)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-muted-foreground w-7 text-right font-mono text-[10px] tabular-nums">
        {value}%
      </span>
    </div>
  )
}

// ─── Quality dots ─────────────────────────────────────────────────────────────

function QualityDots({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground text-[10px]">—</span>
  const filled = Math.round(score)
  return (
    <div className="flex items-center gap-0.5" aria-label={`Quality ${score}/10`}>
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className={cn("size-1.5 rounded-full", i < filled ? "bg-primary" : "bg-muted")}
        />
      ))}
      <span className="text-muted-foreground ml-1 font-mono text-[10px] tabular-nums">{score}</span>
    </div>
  )
}

// ─── Analysis Detail Sheet ────────────────────────────────────────────────────

function AnalysisDetailSheet({
  summary,
  onClose,
  onDeleted,
}: {
  summary: AnalysisSummary | null
  onClose: () => void
  onDeleted?: (id: string) => void
}) {
  const [analysis, setAnalysis] = useState<AiAnalysisData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [viewTrade, setViewTrade] = useState<TradeUnion | null>(null)
  const [isFetchingTrade, setIsFetchingTrade] = useState(false)

  useEffect(() => {
    if (!summary) {
      setAnalysis(null)
      return
    }
    setIsLoading(true)
    fetch(`/api/ai/analyses/${summary.tradeId}/${summary.id}`)
      .then((r) => r.json())
      .then((j: { ok: boolean; data?: AiAnalysisData }) => {
        if (j.ok && j.data) setAnalysis(j.data)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [summary])

  const handleDelete = async () => {
    if (!summary) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/ai/analyses/${summary.tradeId}/${summary.id}`, {
        method: "DELETE",
      })
      const json = (await res.json()) as { ok: boolean }
      if (json.ok) {
        onDeleted?.(summary.id)
        onClose()
      } else {
        toast.error("Failed to delete analysis")
      }
    } catch {
      toast.error("Failed to delete analysis")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleViewTrade = async () => {
    if (!summary) return
    setIsFetchingTrade(true)
    try {
      const res = await fetch(`/api/trades/${summary.tradeId}`)
      const json = (await res.json()) as { ok: boolean; data?: TradeDetailData }
      if (json.ok && json.data) {
        setViewTrade(tradeDetailToUnion(json.data))
      } else {
        toast.error("Trade not found")
      }
    } catch {
      toast.error("Failed to load trade")
    } finally {
      setIsFetchingTrade(false)
    }
  }

  const pair = summary?.instrument.replace("_", "/") ?? ""

  return (
    <>
      <Sheet
        open={!!summary}
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="border-border/50 border-b px-5 pb-3 pt-5">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-lg font-bold">{pair}</SheetTitle>
              {summary && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    summary.direction === "long" ? "text-emerald-600" : "text-red-500",
                  )}
                >
                  {summary.direction === "long" ? "↑ Long" : "↓ Short"}
                </span>
              )}
              {summary && (
                <Badge
                  variant="outline"
                  className={cn("h-5 text-[10px]", analysisBadge(summary.status).className)}
                >
                  {analysisBadge(summary.status).label}
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-1">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
                      disabled={isDeleting}
                      aria-label="Delete analysis"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete analysis?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this AI analysis. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>
                        {isDeleting ? "Deleting…" : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <SheetDescription className="flex flex-wrap items-center gap-3 text-xs">
              {summary && (
                <>
                  <span>{tradeTitle(summary)}</span>
                  <span>·</span>
                  <span>
                    {modelLabel(summary.model)} · {summary.depth}
                  </span>
                  <span>·</span>
                  <span>{formatRelativeTime(summary.createdAt)}</span>
                </>
              )}
            </SheetDescription>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 w-fit gap-1.5 text-xs"
              onClick={() => void handleViewTrade()}
              disabled={isFetchingTrade}
            >
              <ExternalLink className="size-3" />
              {isFetchingTrade ? "Loading…" : "View trade"}
            </Button>
          </SheetHeader>

          <div className="p-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : analysis?.sections ? (
              <AnalysisResults sections={analysis.sections as AiAnalysisSections} />
            ) : analysis && !analysis.sections ? (
              <p className="text-muted-foreground py-10 text-center text-sm">
                {analysis.status === "failed"
                  ? `Analysis failed: ${analysis.errorMessage ?? "unknown error"}`
                  : "No analysis content available"}
              </p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <TradeDetailDrawer
        trade={viewTrade}
        open={!!viewTrade}
        onOpenChange={(open) => {
          if (!open) setViewTrade(null)
        }}
      />
    </>
  )
}

// ─── Analysis Card ────────────────────────────────────────────────────────────

function AnalysisCard({
  row,
  isExpanded,
  onToggle,
  onClick,
}: {
  row: AnalysisSummary
  isExpanded: boolean
  onToggle: () => void
  onClick: () => void
}) {
  const badge = analysisBadge(row.status)
  const isLong = row.direction === "long"

  return (
    <div
      className={cn(
        "border-border/50 rounded-lg border transition-colors",
        isExpanded ? "bg-muted/20" : "hover:bg-muted/10",
      )}
    >
      {/* Primary row */}
      <div
        className="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2"
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onClick()
          }
        }}
        aria-label={`${row.instrument.replace("_", "/")} ${row.direction} analysis — ${badge.label}`}
      >
        {/* Instrument + direction */}
        <span className="shrink-0 font-mono text-xs font-semibold">
          {row.instrument.replace("_", "/")}
        </span>
        <span
          className={cn(
            "shrink-0 text-[10px] font-medium",
            isLong ? "text-emerald-600" : "text-red-500",
          )}
        >
          {isLong ? "↑" : "↓"}
        </span>

        {/* Model badge */}
        <Badge
          variant="outline"
          className={cn("h-5 shrink-0 text-[10px]", modelBadgeColor(row.model))}
        >
          {modelLabel(row.model)}
        </Badge>

        {/* Source badge */}
        <Badge
          variant="outline"
          className={cn(
            "hidden h-5 shrink-0 gap-0.5 text-[10px] sm:inline-flex",
            triggeredByBadgeClass(row.triggeredBy),
          )}
        >
          {AUTO_TRIGGERED_VALUES.has(row.triggeredBy) ? (
            <Bot className="size-2.5" />
          ) : (
            <User className="size-2.5" />
          )}
          {triggeredByLabel(row.triggeredBy)}
        </Badge>

        {/* Status badge */}
        <Badge variant="outline" className={cn("h-5 shrink-0 text-[10px]", badge.className)}>
          {badge.label}
        </Badge>

        {/* Spacer */}
        <div className="min-w-1 flex-1" />

        {/* Cost */}
        <span className="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums">
          ${row.costUsd.toFixed(4)}
        </span>

        {/* Time */}
        <span className="text-muted-foreground hidden shrink-0 text-[10px] sm:inline">
          {formatRelativeTime(row.createdAt)}
        </span>

        {/* Expand chevron */}
        <button
          type="button"
          className="hover:bg-muted/50 focus-visible:ring-ring shrink-0 rounded p-0.5 focus-visible:outline-none focus-visible:ring-2"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          aria-expanded={isExpanded}
          aria-label="Toggle details"
        >
          <ChevronDown
            className={cn(
              "text-muted-foreground size-3 transition-transform duration-200",
              isExpanded && "rotate-180",
            )}
          />
        </button>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-border/50 space-y-2 border-t px-3 py-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Win Probability */}
            <div className="space-y-0.5">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                Win Prob
              </span>
              <WinProbBar value={row.winProbability} />
            </div>
            {/* Quality */}
            <div className="space-y-0.5">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                Quality
              </span>
              <QualityDots score={row.tradeQualityScore} />
            </div>
            {/* Depth */}
            <div className="space-y-0.5">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                Depth
              </span>
              <Badge
                variant="outline"
                className={cn("h-5 text-[10px] capitalize", depthBadgeColor(row.depth))}
              >
                {row.depth}
              </Badge>
            </div>
            {/* Trade subtitle */}
            <div className="space-y-0.5">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                Trade
              </span>
              <p className="text-muted-foreground truncate text-[11px]">{tradeTitle(row)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Analyses Tab ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export function AiAnalysesTab({ onStatsChanged }: { onStatsChanged?: () => void }) {
  const { lastAiAnalysisCompleted } = useDaemonStatus()

  const [rows, setRows] = useState<AnalysisSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [triggeredBy, setTriggeredBy] = useState("all")
  const [status, setStatus] = useState("all")
  const [isLoading, setIsLoading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisSummary | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchData = useCallback(async (p: number, tb: string, st: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) })
      if (tb !== "all") params.set("triggeredBy", tb)
      if (st !== "all") params.set("status", st)
      const res = await fetch(`/api/ai/analyses/list?${params}`)
      const json = (await res.json()) as {
        ok: boolean
        data?: { rows: AnalysisSummary[]; total: number }
      }
      if (json.ok && json.data) {
        setRows(json.data.rows)
        setTotal(json.data.total)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData(page, triggeredBy, status)
  }, [fetchData, page, triggeredBy, status])
  useEffect(() => {
    if (lastAiAnalysisCompleted) void fetchData(page, triggeredBy, status)
  }, [lastAiAnalysisCompleted, fetchData, page, triggeredBy, status])

  const stuckRows = rows.filter(
    (r) =>
      (r.status === "running" || r.status === "pending") &&
      Date.now() - new Date(r.createdAt).getTime() > ANALYSIS_STALE_THRESHOLD_MS,
  )

  const handleResetStuck = async () => {
    setIsResetting(true)
    try {
      await fetch("/api/ai/analyses/reset-stuck", { method: "POST" })
      await fetchData(page, triggeredBy, status)
      onStatsChanged?.()
    } finally {
      setIsResetting(false)
    }
  }

  const handleClearAll = async () => {
    setIsClearing(true)
    try {
      const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"
      await fetch(`${DAEMON_URL}/actions/ai/cancel-all-running`, { method: "POST" }).catch(() => {})
      const res = await fetch("/api/ai/analyses/clear", { method: "DELETE" })
      const json = (await res.json()) as { ok: boolean; data?: { count: number } }
      if (json.ok) {
        toast.success(`Deleted ${json.data?.count ?? 0} analyses`)
        setRows([])
        setTotal(0)
        onStatsChanged?.()
      } else {
        toast.error("Failed to clear analyses")
      }
    } catch {
      toast.error("Failed to clear analyses")
    } finally {
      setIsClearing(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-3">
      <AnalysisDetailSheet
        summary={selectedAnalysis}
        onClose={() => setSelectedAnalysis(null)}
        onDeleted={(id) => {
          setRows((prev) => prev.filter((r) => r.id !== id))
          setTotal((prev) => Math.max(0, prev - 1))
        }}
      />

      {/* Stuck analyses warning */}
      {stuckRows.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
          <p className="flex-1 text-xs text-amber-700">
            {stuckRows.length} analysis{stuckRows.length > 1 ? "es are" : " is"} stuck in
            &quot;Running&quot; — the daemon may have crashed.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0 border-amber-500/40 text-xs text-amber-700 hover:bg-amber-500/10"
            disabled={isResetting}
            onClick={() => void handleResetStuck()}
          >
            {isResetting ? "Resetting…" : `Reset ${stuckRows.length > 1 ? "all" : "it"}`}
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={triggeredBy}
          onValueChange={(v) => {
            setPage(1)
            setTriggeredBy(v)
          }}
        >
          <SelectTrigger className="w-[140px]" aria-label="Filter by source">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="automated">Automated</SelectItem>
            <SelectItem value="user">Manual</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(1)
            setStatus(v)
          }}
        >
          <SelectTrigger className="w-[140px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-xs">{total > 0 && `${total} total`}</span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive ml-auto h-8 gap-1.5 text-xs"
              disabled={total === 0 || isClearing}
            >
              <Trash2 className="size-3" />
              Clear All
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all analyses?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all {total} AI analyses. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => void handleClearAll()}>
                {isClearing ? "Clearing…" : "Clear All"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Card list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">No analyses found</p>
      ) : (
        <div className="space-y-1">
          {rows.map((row) => (
            <AnalysisCard
              key={row.id}
              row={row}
              isExpanded={expandedId === row.id}
              onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
              onClick={() => setSelectedAnalysis(row)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="size-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
