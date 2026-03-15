"use client"

import { useState, useMemo, useEffect } from "react"
import type {
  PendingOrderData,
  OpenTradeData,
  ClosedTradeData,
  PositionPriceTick,
  TradeDirection,
  TradeTagData,
  AiAnalysisData,
} from "@fxflow/types"
import type { ActiveAnalysisProgress } from "@/hooks/use-active-ai-analyses"
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
import { TradeCard } from "./trade-card"
import { TradeDetailDrawer, type TradeUnion } from "./trade-detail-drawer"
import { CloseTradeDialog } from "./close-trade-dialog"
import { CancelOrderDialog } from "./cancel-order-dialog"
import { AiAnalysisSheet } from "@/components/ai/ai-analysis-sheet"
import { useTradeActions } from "@/hooks/use-trade-actions"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import {
  ArrowUpDown,
  Trash2,
  Clock,
  CircleDot,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/ui/empty-state"
import { compareValues, type SortState } from "./sortable-head"

type TradeCardVariant = "pending" | "open" | "closed"

interface TradeCardListProps {
  variant: TradeCardVariant
  trades: (PendingOrderData | OpenTradeData | ClosedTradeData)[]
  pricesByInstrument?: Map<string, PositionPriceTick>
  tagsByTradeId?: Record<string, TradeTagData[]>
  currency?: string
  instrumentFilter?: string
  directionFilter?: TradeDirection | ""
  latestAnalysisByTradeId?: Record<string, AiAnalysisData>
  countByTradeId?: Record<string, number>
  activeAiByTradeId?: Record<string, ActiveAnalysisProgress>
  triggerAiFor?: PendingOrderData | OpenTradeData | null
  onTagMutated?: () => void
  // Pagination (for history tab)
  isLoading?: boolean
  totalCount?: number
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
}

const SORT_OPTIONS = [
  { key: "instrument", label: "Pair" },
  { key: "direction", label: "Direction" },
  { key: "unrealizedPL", label: "P/L" },
  { key: "openedAt", label: "Time" },
] as const

export function TradeCardList({
  variant,
  trades,
  pricesByInstrument,
  tagsByTradeId = {},
  currency = "USD",
  instrumentFilter = "",
  directionFilter = "",
  latestAnalysisByTradeId,
  countByTradeId,
  activeAiByTradeId,
  triggerAiFor,
  onTagMutated,
  isLoading = false,
  totalCount,
  page,
  pageSize,
  onPageChange,
}: TradeCardListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sort, setSort] = useState<SortState>({
    key: variant === "closed" ? "closedAt" : "unrealizedPL",
    direction: "desc",
  })
  const [drawerTrade, setDrawerTrade] = useState<
    PendingOrderData | OpenTradeData | ClosedTradeData | null
  >(null)
  const [closeTrade, setCloseTrade] = useState<OpenTradeData | null>(null)
  const [cancelOrder, setCancelOrder] = useState<PendingOrderData | null>(null)
  const [aiAnalysisTrade, setAiAnalysisTrade] = useState<PendingOrderData | OpenTradeData | null>(
    null,
  )
  const [isClosingAll, setIsClosingAll] = useState(false)
  const {
    closeTrade: doCloseTrade,
    closeAllTrades,
    cancelOrder: doCancelOrder,
    refreshPositions,
    isLoading: actionLoading,
  } = useTradeActions()
  const { positions, setPositions } = useDaemonStatus()

  // Deep-link: open AI sheet for a specific trade
  useEffect(() => {
    if (triggerAiFor) setAiAnalysisTrade(triggerAiFor)
  }, [(triggerAiFor as { id?: string } | null | undefined)?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter
  const filtered = useMemo(() => {
    let result = trades
    if (instrumentFilter) result = result.filter((t) => t.instrument === instrumentFilter)
    if (directionFilter) result = result.filter((t) => t.direction === directionFilter)
    return result
  }, [trades, instrumentFilter, directionFilter])

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const key = sort.key
      let va: unknown, vb: unknown
      switch (key) {
        case "instrument":
          va = a.instrument
          vb = b.instrument
          break
        case "direction":
          va = a.direction
          vb = b.direction
          break
        case "unrealizedPL":
          va = "unrealizedPL" in a ? a.unrealizedPL : "realizedPL" in a ? a.realizedPL : 0
          vb = "unrealizedPL" in b ? b.unrealizedPL : "realizedPL" in b ? b.realizedPL : 0
          break
        case "openedAt":
          va = "openedAt" in a ? a.openedAt : "createdAt" in a ? a.createdAt : ""
          vb = "openedAt" in b ? b.openedAt : "createdAt" in b ? b.createdAt : ""
          break
        case "closedAt":
          va = "closedAt" in a ? a.closedAt : ""
          vb = "closedAt" in b ? b.closedAt : ""
          break
        default:
          va = a.instrument
          vb = b.instrument
      }
      return compareValues(va, vb, sort.direction)
    })
  }, [filtered, sort])

  // Keep drawer trade in sync with latest data
  const liveDrawerTrade = useMemo(() => {
    if (!drawerTrade) return null
    return trades.find((t) => t.id === drawerTrade.id) ?? drawerTrade
  }, [drawerTrade, trades])

  const handleCloseConfirm = async (units?: number, reason?: string) => {
    if (!closeTrade) return
    const tradeId = closeTrade.sourceTradeId
    const ok = await doCloseTrade(tradeId, units, reason)
    if (ok) {
      setCloseTrade(null)
      if (!units && positions) {
        setPositions({
          ...positions,
          open: positions.open.filter((t) => t.sourceTradeId !== tradeId),
        })
      }
      void refreshPositions()
    }
  }

  const handleCancelConfirm = async () => {
    if (!cancelOrder) return
    const ok = await doCancelOrder(cancelOrder.sourceOrderId)
    if (ok) {
      setCancelOrder(null)
      void refreshPositions()
    }
  }

  const handleCloseAll = async () => {
    setIsClosingAll(true)
    try {
      const result = await closeAllTrades(undefined)
      if (result.succeeded > 0) {
        await refreshPositions()
      }
    } finally {
      setIsClosingAll(false)
    }
  }

  const handleSortToggle = (key: string) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }))
  }

  const hasPagination =
    totalCount !== undefined && page !== undefined && pageSize !== undefined && onPageChange
  const totalPages = hasPagination ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1

  if (isLoading) {
    return (
      <div className="text-muted-foreground animate-pulse py-12 text-center text-sm">Loading…</div>
    )
  }

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={variant === "pending" ? Clock : variant === "open" ? CircleDot : TrendingUp}
        title={
          variant === "pending"
            ? "No pending orders"
            : variant === "open"
              ? "No open trades"
              : "No trade history"
        }
        description={
          variant === "pending"
            ? "Limit and stop orders will appear here when placed."
            : variant === "open"
              ? "Place your first trade to see it here."
              : "Closed trades will appear here after your positions are resolved."
        }
      />
    )
  }

  const drawerTradeUnion: TradeUnion | null = liveDrawerTrade
    ? ({ ...liveDrawerTrade, _type: variant } as TradeUnion)
    : null

  return (
    <>
      {/* Sort controls + actions */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="bg-muted/40 flex items-center gap-0.5 rounded-lg p-0.5">
          <ArrowUpDown className="text-muted-foreground mx-1.5 size-3" />
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleSortToggle(opt.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                sort.key === opt.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
              {sort.key === opt.key && (
                <span className="ml-0.5 text-[9px]">{sort.direction === "asc" ? "↑" : "↓"}</span>
              )}
            </button>
          ))}
        </div>

        {variant === "open" && sorted.length > 1 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive gap-1.5"
                disabled={isClosingAll || actionLoading}
              >
                <Trash2 className="size-3.5" />
                {isClosingAll ? "Closing..." : `Close All (${sorted.length})`}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Close all {sorted.length} open trades?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will close every open trade at the current market price. This action cannot
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Trades</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCloseAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Close All Trades
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Card list */}
      <div className="space-y-3">
        {sorted.map((trade) => (
          <TradeCard
            key={trade.id}
            variant={variant}
            data={trade}
            currency={currency}
            currentPrice={
              variant === "pending" && pricesByInstrument
                ? (pricesByInstrument.get(trade.instrument)?.bid ?? null)
                : undefined
            }
            isExpanded={expandedId === trade.id}
            onToggleExpand={() => setExpandedId(expandedId === trade.id ? null : trade.id)}
            onViewDetails={() => setDrawerTrade(trade)}
            onCloseTrade={
              variant === "open" ? () => setCloseTrade(trade as OpenTradeData) : undefined
            }
            onCancelOrder={
              variant === "pending" ? () => setCancelOrder(trade as PendingOrderData) : undefined
            }
            onAiAnalysis={() => setAiAnalysisTrade(trade as PendingOrderData | OpenTradeData)}
            tags={tagsByTradeId[trade.id]}
            latestAnalysis={latestAnalysisByTradeId?.[trade.id]}
            analysisCount={countByTradeId?.[trade.id]}
            activeAiProgress={activeAiByTradeId?.[trade.id]}
          />
        ))}
      </div>

      {/* Pagination */}
      {hasPagination && totalPages > 1 && (
        <div className="flex items-center justify-between pt-3">
          <span className="text-muted-foreground text-xs">
            {totalCount} trade{totalCount !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="text-muted-foreground px-2 text-xs tabular-nums">
              {page}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <TradeDetailDrawer
        trade={drawerTradeUnion}
        open={!!drawerTrade}
        onOpenChange={(open) => !open && setDrawerTrade(null)}
        currency={currency}
        lastTick={
          liveDrawerTrade && pricesByInstrument
            ? (pricesByInstrument.get(liveDrawerTrade.instrument) ?? null)
            : null
        }
        onCloseTrade={
          variant === "open" && liveDrawerTrade
            ? () => {
                setDrawerTrade(null)
                setCloseTrade(liveDrawerTrade as OpenTradeData)
              }
            : undefined
        }
        onTagMutated={onTagMutated}
      />
      <CloseTradeDialog
        trade={closeTrade}
        open={!!closeTrade}
        onOpenChange={(open) => !open && setCloseTrade(null)}
        onConfirm={handleCloseConfirm}
        isLoading={actionLoading}
        currency={currency}
      />
      {cancelOrder && (
        <CancelOrderDialog
          order={cancelOrder}
          open={!!cancelOrder}
          onOpenChange={(open) => !open && setCancelOrder(null)}
          onConfirm={handleCancelConfirm}
          isLoading={actionLoading}
        />
      )}
      <AiAnalysisSheet
        trade={aiAnalysisTrade}
        tradeStatus={variant === "pending" ? "pending" : "open"}
        open={!!aiAnalysisTrade}
        onOpenChange={(open) => !open && setAiAnalysisTrade(null)}
      />
    </>
  )
}
