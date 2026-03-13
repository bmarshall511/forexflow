"use client"

import { useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { useTVAlertsSignals } from "@/hooks/use-tv-alerts-signals"
import { cn } from "@/lib/utils"
import { SignalAuditTrail } from "./signal-audit-trail"
import type { TVAlertSignal, TVAlertStatus } from "@fxflow/types"

const STATUS_STYLES: Record<TVAlertStatus, { dot: string; label: string; badge: string }> = {
  received: { dot: "bg-blue-500", label: "Received", badge: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  executing: { dot: "bg-amber-500 animate-pulse", label: "Executing", badge: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  executed: { dot: "bg-green-500", label: "Executed", badge: "bg-green-500/10 text-green-500 border-green-500/20" },
  skipped: { dot: "bg-slate-500", label: "Skipped", badge: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  rejected: { dot: "bg-yellow-500", label: "Rejected", badge: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  failed: { dot: "bg-red-500", label: "Failed", badge: "bg-red-500/10 text-red-500 border-red-500/20" },
}

const STATUS_FILTERS: TVAlertStatus[] = ["received", "executing", "executed", "rejected", "skipped", "failed"]

interface TVAlertsSignalTableProps {
  onStatsRefresh?: () => void
}

export function TVAlertsSignalTable({ onStatsRefresh }: TVAlertsSignalTableProps) {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const { signals, totalCount, isLoading, refresh, page, setPage, clearAll } = useTVAlertsSignals({
    status: statusFilter,
    pageSize: 15,
  })
  const [isClearing, setIsClearing] = useState(false)
  const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null)

  const totalPages = Math.ceil(totalCount / 15)

  const handleClear = async () => {
    setIsClearing(true)
    try {
      await clearAll()
      onStatsRefresh?.()
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold">Signal History</h3>
        <div className="flex items-center gap-2">
            {/* Status filter pills */}
            <div className="inline-flex h-8 rounded-lg bg-muted/40 p-0.5 gap-0.5" role="group">
              <button
                type="button"
                onClick={() => { setStatusFilter(undefined); setPage(1) }}
                className={cn(
                  "px-2.5 text-xs font-medium rounded-md transition-all",
                  !statusFilter
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={!statusFilter}
              >
                All
              </button>
              {STATUS_FILTERS.map((s) => {
                const style = STATUS_STYLES[s]
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setStatusFilter(s); setPage(1) }}
                    className={cn(
                      "px-2.5 text-xs font-medium rounded-md transition-all flex items-center gap-1",
                      statusFilter === s
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={statusFilter === s}
                  >
                    <span className={cn("size-1.5 rounded-full", style.dot)} />
                    <span className="hidden sm:inline">{style.label}</span>
                  </button>
                )
              })}
            </div>

            <Button variant="outline" size="icon" className="size-7" onClick={refresh} aria-label="Refresh signals">
              <RefreshCw className="size-3" />
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  disabled={isClearing || totalCount === 0}
                >
                  <Trash2 className="mr-1 size-3" />
                  Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all signal history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {totalCount} signal records. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClear}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground animate-pulse">Loading signals...</p>
      ) : signals.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No signals recorded yet</p>
      ) : (
        <>
          <div className="space-y-1">
            {signals.map((signal) => (
              <SignalCard
                key={signal.id}
                signal={signal}
                isExpanded={expandedSignalId === signal.id}
                onToggle={() => setExpandedSignalId(expandedSignalId === signal.id ? null : signal.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3">
              <span className="text-xs text-muted-foreground">
                {totalCount} signal{totalCount !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground px-2 tabular-nums">
                  {page}/{totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SignalCard({ signal, isExpanded, onToggle }: { signal: TVAlertSignal; isExpanded: boolean; onToggle: () => void }) {
  const style = STATUS_STYLES[signal.status] ?? STATUS_STYLES.received
  const isBuy = signal.direction === "buy"
  const time = new Date(signal.receivedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  // Latency: difference between daemon receipt and TradingView candle close
  const latencyMs = signal.signalTime
    ? new Date(signal.receivedAt).getTime() - new Date(signal.signalTime).getTime()
    : null
  const latencyLabel = latencyMs !== null && latencyMs >= 0
    ? `+${(latencyMs / 1000).toFixed(1)}s`
    : null

  const pl = signal.executionDetails?.realizedPL

  const reason = signal.status === "executed" && signal.executionDetails?.isProtectiveClose
    ? "Protective Close"
    : signal.status === "executed" && signal.executionDetails?.isReversal
      ? "Reversal"
      : signal.rejectionReason?.replace(/_/g, " ") ?? null

  return (
    <div className={cn(
      "rounded-lg border border-border/50 transition-colors",
      isExpanded ? "bg-muted/20" : "hover:bg-muted/10",
    )}>
      <button
        type="button"
        className="w-full text-left px-3 py-2 flex items-center gap-2 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-lg"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${signal.instrument.replace("_", "/")} ${signal.direction} signal — ${style.label}`}
      >
        {/* Status dot + time */}
        <span className={cn("size-2 rounded-full shrink-0", style.dot)} />
        <span className="text-[10px] text-muted-foreground font-mono tabular-nums shrink-0 hidden sm:inline">
          {time}
          {latencyLabel && (
            <span className="ml-1 text-muted-foreground/60" title="Webhook delivery latency">{latencyLabel}</span>
          )}
        </span>

        {/* Instrument + direction */}
        <span className="text-xs font-semibold shrink-0">
          {signal.instrument.replace("_", "/")}
        </span>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-medium shrink-0",
            isBuy
              ? "border-green-500/30 bg-green-500/10 text-green-500"
              : "border-red-500/30 bg-red-500/10 text-red-500",
          )}
        >
          {isBuy ? "BUY" : "SELL"}
        </Badge>

        {/* Test badge */}
        {signal.isTest && (
          <Badge variant="outline" className="text-[10px] font-medium border-amber-500/30 bg-amber-500/10 text-amber-500 shrink-0">
            Test
          </Badge>
        )}

        {/* Status badge */}
        <Badge variant="outline" className={cn("text-[10px] font-medium shrink-0", style.badge)}>
          {style.label}
        </Badge>

        {/* Reason (if any) */}
        {reason && (
          <span className="text-[10px] text-muted-foreground truncate hidden md:inline">
            {reason}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1 min-w-1" />

        {/* P&L */}
        {pl !== undefined ? (
          <span className={cn("text-xs font-semibold font-mono tabular-nums shrink-0", pl >= 0 ? "text-status-connected" : "text-status-disconnected")}>
            {pl >= 0 ? "+" : ""}{pl.toFixed(2)}
          </span>
        ) : null}

        {/* Mobile time */}
        <span className="text-[10px] text-muted-foreground font-mono tabular-nums shrink-0 sm:hidden">
          {time}
        </span>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            "size-3 text-muted-foreground transition-transform duration-200 shrink-0",
            isExpanded && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {/* Expanded: audit trail */}
      {isExpanded && (
        <div className="border-t border-border/50 px-3 py-2">
          <div className="border-l-2 border-primary/30 pl-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              Audit Trail
              {signal.rawPayload && (
                <Badge variant="outline" className="text-[10px]">
                  Raw payload available
                </Badge>
              )}
            </div>

            {signal.rawPayload && (
              <details className="text-xs">
                <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                  View raw webhook payload
                </summary>
                <pre className="mt-1 overflow-x-auto rounded border bg-muted/50 p-2 text-[11px] leading-relaxed text-muted-foreground">
                  {JSON.stringify(signal.rawPayload, null, 2)}
                </pre>
              </details>
            )}

            {signal.resultTradeId && (
              <p className="text-xs text-muted-foreground">
                Trade ID: <span className="font-mono">{signal.resultTradeId}</span>
              </p>
            )}

            <SignalAuditTrail signalId={signal.id} />
          </div>
        </div>
      )}
    </div>
  )
}
