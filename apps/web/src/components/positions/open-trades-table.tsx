"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import type {
  OpenTradeData,
  PositionPriceTick,
  TradeDirection,
  TradeTagData,
  AiAnalysisData,
} from "@fxflow/types"
import type { ActiveAnalysisProgress } from "@/hooks/use-active-ai-analyses"
import { Table, TableHeader, TableHead, TableBody, TableRow } from "@/components/ui/table"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { TradeCardMobile } from "./trade-card-mobile"
import { OpenTradeRow } from "./open-trade-row"
import { SortableHead, nextSort, compareValues, type SortState } from "./sortable-head"
import { TradeDetailDrawer } from "./trade-detail-drawer"
import { CloseTradeDialog } from "./close-trade-dialog"
import { useTradeActions } from "@/hooks/use-trade-actions"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { AiAnalysisSheet } from "@/components/ai/ai-analysis-sheet"
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
import { Trash2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useBulkSelection } from "@/hooks/use-bulk-selection"
import { BulkActionBar } from "./bulk-action-bar"

interface OpenTradesTableProps {
  trades: OpenTradeData[]
  /** Live price ticks for real-time chart candle updates in the drawer */
  pricesByInstrument?: Map<string, PositionPriceTick>
  tagsByTradeId?: Record<string, TradeTagData[]>
  currency?: string
  instrumentFilter?: string
  directionFilter?: TradeDirection | ""
  latestAnalysisByTradeId?: Record<string, AiAnalysisData>
  countByTradeId?: Record<string, number>
  activeAiByTradeId?: Record<string, ActiveAnalysisProgress>
  triggerAiFor?: OpenTradeData | null
  onTagMutated?: () => void
}

export function OpenTradesTable({
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
}: OpenTradesTableProps) {
  const isMobile = useIsMobile()
  const [sort, setSort] = useState<SortState>({ key: "unrealizedPL", direction: "asc" })
  const [drawerTrade, setDrawerTrade] = useState<OpenTradeData | null>(null)
  const [closeTrade, setCloseTrade] = useState<OpenTradeData | null>(null)
  const [aiAnalysisTrade, setAiAnalysisTrade] = useState<OpenTradeData | null>(null)
  const {
    closeTrade: doCloseTrade,
    closeAllTrades,
    refreshPositions,
    isLoading: actionLoading,
  } = useTradeActions()
  const { positions, setPositions } = useDaemonStatus()
  const [isClosingAll, setIsClosingAll] = useState(false)
  const bulk = useBulkSelection<OpenTradeData>()
  const [isBulkClosing, setIsBulkClosing] = useState(false)

  // Deep-link support: open the AI sheet when a specific trade is passed from the parent
  useEffect(() => {
    if (triggerAiFor) setAiAnalysisTrade(triggerAiFor)
  }, [triggerAiFor?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stable order: only re-sort when user clicks a column, not on every price tick.
  const sortVersionRef = useRef(0)
  const [sortVersion, setSortVersion] = useState(0)

  const handleSort = (key: string) => {
    const next = nextSort(sort, key)
    setSort(next)
    sortVersionRef.current++
    setSortVersion(sortVersionRef.current)
  }

  // Keep drawer trade in sync with latest price data
  const liveDrawerTrade = useMemo(() => {
    if (!drawerTrade) return null
    return trades.find((t) => t.id === drawerTrade.id) ?? drawerTrade
  }, [drawerTrade, trades])

  // Filter only — no sort here (sort is applied below with stable logic)
  const filteredTrades = useMemo(() => {
    let result = trades
    if (instrumentFilter) result = result.filter((t) => t.instrument === instrumentFilter)
    if (directionFilter) result = result.filter((t) => t.direction === directionFilter)
    return result
  }, [trades, instrumentFilter, directionFilter])

  // Sort only when sort state changes (user clicks column), not on data changes.
  const sortedOrderRef = useRef<string[]>([])

  useMemo(() => {
    const arr = [...filteredTrades].sort((a, b) => {
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
        case "source":
          va = a.source
          vb = b.source
          break
        case "timeframe":
          va = a.timeframe
          vb = b.timeframe
          break
        case "entryPrice":
          va = a.entryPrice
          vb = b.entryPrice
          break
        case "currentPrice":
          va = a.currentPrice
          vb = b.currentPrice
          break
        case "stopLoss":
          va = a.stopLoss
          vb = b.stopLoss
          break
        case "takeProfit":
          va = a.takeProfit
          vb = b.takeProfit
          break
        case "units":
          va = a.currentUnits
          vb = b.currentUnits
          break
        case "unrealizedPL":
          va = a.unrealizedPL
          vb = b.unrealizedPL
          break
        case "mfe":
          va = a.mfe
          vb = b.mfe
          break
        case "mae":
          va = a.mae
          vb = b.mae
          break
        case "openedAt":
          va = a.openedAt
          vb = b.openedAt
          break
        case "tags":
          va = (tagsByTradeId[a.id] ?? a.tags).length
          vb = (tagsByTradeId[b.id] ?? b.tags).length
          break
        default:
          va = a.instrument
          vb = b.instrument
      }
      return compareValues(va, vb, sort.direction)
    })
    sortedOrderRef.current = arr.map((t) => t.id)
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortVersion, filteredTrades.length, instrumentFilter, directionFilter])

  // On price-only updates (trade data changed but sort didn't), use the stored order
  const stableResult = useMemo(() => {
    if (sortedOrderRef.current.length === 0) return filteredTrades

    const orderMap = new Map(sortedOrderRef.current.map((id, i) => [id, i]))
    const inOrder: OpenTradeData[] = []
    const newTrades: OpenTradeData[] = []

    for (const trade of filteredTrades) {
      const idx = orderMap.get(trade.id)
      if (idx !== undefined) {
        inOrder[idx] = trade
      } else {
        newTrades.push(trade)
      }
    }

    const result = inOrder.filter(Boolean).concat(newTrades)
    return result
  }, [filteredTrades])

  const handleCloseConfirm = async (units?: number, reason?: string) => {
    if (!closeTrade) return
    const tradeId = closeTrade.sourceTradeId
    const ok = await doCloseTrade(tradeId, units, reason)
    if (ok) {
      setCloseTrade(null)
      // Optimistic update: remove (full close) or trigger refresh (partial close).
      // The daemon's reconcile() may still return the trade as open for 1-2 seconds
      // due to OANDA API propagation delay — this ensures the row disappears instantly.
      if (!units && positions) {
        setPositions({
          ...positions,
          open: positions.open.filter((t) => t.sourceTradeId !== tradeId),
        })
      }
      // Belt-and-suspenders: daemon re-sync so partial closes and data corrections
      // arrive quickly without waiting for the next scheduled reconcile.
      void refreshPositions()
    }
  }

  const handleCloseAll = async () => {
    setIsClosingAll(true)
    try {
      const result = await closeAllTrades(undefined)
      // Belt-and-suspenders: force an immediate position refresh after close-all
      // so the table updates even if the daemon's WebSocket broadcast is delayed.
      if (result.succeeded > 0) {
        await refreshPositions()
      }
    } finally {
      setIsClosingAll(false)
    }
  }

  const handleBulkClose = async () => {
    const ids = stableResult.filter((t) => bulk.isSelected(t.id)).map((t) => t.sourceTradeId)
    if (ids.length === 0) return
    setIsBulkClosing(true)
    try {
      const result = await closeAllTrades(ids)
      if (result.succeeded > 0) {
        bulk.clear()
        await refreshPositions()
      }
    } finally {
      setIsBulkClosing(false)
    }
  }

  if (stableResult.length === 0) {
    return <div className="text-muted-foreground py-12 text-center text-sm">No open trades</div>
  }

  if (isMobile) {
    return (
      <>
        <div className="space-y-3">
          {stableResult.map((trade) => (
            <TradeCardMobile
              key={trade.id}
              variant="open"
              data={trade}
              currency={currency}
              onViewDetails={() => setDrawerTrade(trade)}
              onCloseTrade={() => setCloseTrade(trade)}
            />
          ))}
        </div>
        <TradeDetailDrawer
          trade={liveDrawerTrade ? { ...liveDrawerTrade, _type: "open" } : null}
          open={!!drawerTrade}
          onOpenChange={(open) => !open && setDrawerTrade(null)}
          currency={currency}
          lastTick={
            liveDrawerTrade ? (pricesByInstrument?.get(liveDrawerTrade.instrument) ?? null) : null
          }
          onCloseTrade={() => {
            if (liveDrawerTrade) {
              setDrawerTrade(null)
              setCloseTrade(liveDrawerTrade)
            }
          }}
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
      </>
    )
  }

  return (
    <>
      {stableResult.length > 1 && (
        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive gap-1.5"
                disabled={isClosingAll || actionLoading}
              >
                <Trash2 className="size-3.5" />
                {isClosingAll ? "Closing…" : `Close All (${stableResult.length})`}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Close all {stableResult.length} open trades?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will close every open trade at the current market price. Realised P&amp;L
                  will be applied immediately. This action cannot be undone.
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
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={
                  bulk.isAllSelected(stableResult)
                    ? true
                    : bulk.isSomeSelected(stableResult)
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={() => bulk.toggleAll(stableResult)}
                aria-label="Select all trades"
              />
            </TableHead>
            <SortableHead
              label="Pair"
              sortKey="instrument"
              currentSort={sort}
              onSort={handleSort}
            />
            <SortableHead
              label="Side"
              sortKey="direction"
              currentSort={sort}
              onSort={handleSort}
              title="Buy or Sell"
            />
            <SortableHead label="Source" sortKey="source" currentSort={sort} onSort={handleSort} />
            <SortableHead
              label="TF"
              sortKey="timeframe"
              currentSort={sort}
              onSort={handleSort}
              title="Chart Timeframe"
            />
            <SortableHead
              label="Entry"
              sortKey="entryPrice"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
              title="Price you entered at"
            />
            <SortableHead
              label="Now"
              sortKey="currentPrice"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
              title="Current market price"
            />
            <TableHead className="text-right" title="Current bid/ask spread">
              Spread
            </TableHead>
            <SortableHead
              label="Stop"
              sortKey="stopLoss"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
              title="Stop Loss — auto-closes to limit losses"
            />
            <SortableHead
              label="Target"
              sortKey="takeProfit"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
              title="Take Profit — auto-closes to lock in gains"
            />
            <SortableHead
              label="Progress"
              sortKey=""
              currentSort={sort}
              onSort={() => {}}
              className="w-36"
              title="How close price is to your stop loss or target"
            />
            <SortableHead
              label="Size"
              sortKey="units"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
              title="Position size in units"
            />
            <SortableHead
              label="P/L"
              sortKey="unrealizedPL"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
              title="Current profit or loss (not yet closed)"
            />
            <SortableHead
              label="R:R"
              sortKey="rr"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
              title="Risk to Reward — how much you could gain vs lose"
            />
            <SortableHead
              label="Best"
              sortKey="mfe"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
              title="Best price reached in your favor (pips)"
            />
            <SortableHead
              label="Worst"
              sortKey="mae"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
              title="Worst price dip against you (pips)"
            />
            <SortableHead
              label="Open For"
              sortKey="openedAt"
              currentSort={sort}
              onSort={handleSort}
              title="How long this trade has been open"
            />
            <SortableHead label="Tags" sortKey="tags" currentSort={sort} onSort={handleSort} />
            <TableHead className="w-10">AI</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {stableResult.map((trade) => (
            <OpenTradeRow
              key={trade.id}
              trade={trade}
              tick={pricesByInstrument?.get(trade.instrument)}
              tags={tagsByTradeId[trade.id] ?? trade.tags}
              currency={currency}
              isSelected={bulk.isSelected(trade.id)}
              latestAnalysis={latestAnalysisByTradeId?.[trade.id]}
              analysisCount={countByTradeId?.[trade.id]}
              activeProgress={activeAiByTradeId?.[trade.id]}
              onToggleSelect={() => bulk.toggle(trade.id)}
              onViewDetails={() => setDrawerTrade(trade)}
              onCloseTrade={() => setCloseTrade(trade)}
              onAiAnalysis={() => setAiAnalysisTrade(trade)}
              onTimeframeChange={async (tf) => {
                await fetch(`/api/trades/${trade.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ timeframe: tf }),
                })
                await refreshPositions()
              }}
            />
          ))}
        </TableBody>
      </Table>

      <TradeDetailDrawer
        trade={liveDrawerTrade ? { ...liveDrawerTrade, _type: "open" } : null}
        open={!!drawerTrade}
        onOpenChange={(open) => !open && setDrawerTrade(null)}
        currency={currency}
        lastTick={
          liveDrawerTrade ? (pricesByInstrument?.get(liveDrawerTrade.instrument) ?? null) : null
        }
        onCloseTrade={() => {
          if (liveDrawerTrade) {
            setDrawerTrade(null)
            setCloseTrade(liveDrawerTrade)
          }
        }}
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
      <AiAnalysisSheet
        trade={aiAnalysisTrade}
        tradeStatus="open"
        open={!!aiAnalysisTrade}
        onOpenChange={(open) => !open && setAiAnalysisTrade(null)}
      />
      <BulkActionBar
        count={bulk.count}
        type="open"
        onClose={handleBulkClose}
        onClear={bulk.clear}
        isLoading={isBulkClosing}
      />
    </>
  )
}
