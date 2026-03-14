"use client"

import { useState, useMemo, useEffect } from "react"
import type {
  PendingOrderData,
  PositionPriceTick,
  TradeDirection,
  TradeTagData,
  AiAnalysisData,
} from "@fxflow/types"
import type { ActiveAnalysisProgress } from "@/hooks/use-active-ai-analyses"
import { formatRelativeTime, formatCurrency } from "@fxflow/shared"
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { DirectionBadge } from "./direction-badge"
import { SourceBadge } from "./source-badge"
import { TimeframeSelect } from "./timeframe-select"
import { TagBadges } from "./tag-badges"
import { RiskRewardDisplay } from "./risk-reward-display"
import { PendingProgressBar } from "./progress-bar-pending"
import { TradeCardMobile } from "./trade-card-mobile"
import { SortableHead, nextSort, compareValues, type SortState } from "./sortable-head"
import { TradeDetailDrawer } from "./trade-detail-drawer"
import { CancelOrderDialog } from "./cancel-order-dialog"
import { useTradeActions } from "@/hooks/use-trade-actions"
import { AiAnalysisSheet } from "@/components/ai/ai-analysis-sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { AiAnalysisCell } from "./ai-analysis-cell"
import { MoreHorizontal, Eye, XCircle, Sparkles, Trash2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useBulkSelection } from "@/hooks/use-bulk-selection"
import { BulkActionBar } from "./bulk-action-bar"

interface PendingOrdersTableProps {
  orders: PendingOrderData[]
  pricesByInstrument: Map<string, PositionPriceTick>
  tagsByTradeId?: Record<string, TradeTagData[]>
  instrumentFilter?: string
  directionFilter?: TradeDirection | ""
  currency?: string
  latestAnalysisByTradeId?: Record<string, AiAnalysisData>
  countByTradeId?: Record<string, number>
  activeAiByTradeId?: Record<string, ActiveAnalysisProgress>
  triggerAiFor?: PendingOrderData | null
  onTagMutated?: () => void
}

function getGainLoss(order: PendingOrderData): { gain: number | null; loss: number | null } {
  const units = order.units
  let gain: number | null = null
  let loss: number | null = null

  if (order.takeProfit !== null) {
    const dist =
      order.direction === "long"
        ? order.takeProfit - order.entryPrice
        : order.entryPrice - order.takeProfit
    gain = dist * units
  }

  if (order.stopLoss !== null) {
    const dist =
      order.direction === "long"
        ? order.entryPrice - order.stopLoss
        : order.stopLoss - order.entryPrice
    loss = -(dist * units)
  }

  return { gain, loss }
}

export function PendingOrdersTable({
  orders,
  pricesByInstrument,
  tagsByTradeId = {},
  instrumentFilter = "",
  directionFilter = "",
  currency = "USD",
  latestAnalysisByTradeId,
  countByTradeId,
  activeAiByTradeId,
  triggerAiFor,
  onTagMutated,
}: PendingOrdersTableProps) {
  const isMobile = useIsMobile()
  const [sort, setSort] = useState<SortState>({ key: "instrument", direction: "asc" })
  const [drawerOrder, setDrawerOrder] = useState<PendingOrderData | null>(null)
  const [cancelOrder, setCancelOrder] = useState<PendingOrderData | null>(null)
  const [aiAnalysisOrder, setAiAnalysisOrder] = useState<PendingOrderData | null>(null)
  const {
    cancelOrder: doCancelOrder,
    cancelAllOrders,
    refreshPositions,
    isLoading: actionLoading,
  } = useTradeActions()
  const [isCancellingAll, setIsCancellingAll] = useState(false)
  const bulk = useBulkSelection<PendingOrderData>()
  const [isBulkCancelling, setIsBulkCancelling] = useState(false)

  useEffect(() => {
    if (triggerAiFor) setAiAnalysisOrder(triggerAiFor)
  }, [triggerAiFor?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (key: string) => setSort(nextSort(sort, key))

  // Helper to get current price for an order
  const getCurrentPrice = (order: PendingOrderData): number | null => {
    const tick = pricesByInstrument.get(order.instrument)
    if (!tick) return null
    return order.direction === "long" ? tick.ask : tick.bid
  }

  const filtered = useMemo(() => {
    let result = orders
    if (instrumentFilter) result = result.filter((o) => o.instrument === instrumentFilter)
    if (directionFilter) result = result.filter((o) => o.direction === directionFilter)

    return [...result].sort((a, b) => {
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
        case "orderType":
          va = a.orderType
          vb = b.orderType
          break
        case "entryPrice":
          va = a.entryPrice
          vb = b.entryPrice
          break
        case "currentPrice": {
          va = getCurrentPrice(a)
          vb = getCurrentPrice(b)
          break
        }
        case "distance": {
          const pa = getCurrentPrice(a)
          const pb = getCurrentPrice(b)
          va = pa !== null ? Math.abs(pa - a.entryPrice) : null
          vb = pb !== null ? Math.abs(pb - b.entryPrice) : null
          break
        }
        case "stopLoss":
          va = a.stopLoss
          vb = b.stopLoss
          break
        case "takeProfit":
          va = a.takeProfit
          vb = b.takeProfit
          break
        case "units":
          va = a.units
          vb = b.units
          break
        case "createdAt":
          va = a.createdAt
          vb = b.createdAt
          break
        case "tags": {
          va = (tagsByTradeId[a.id] ?? a.tags).length
          vb = (tagsByTradeId[b.id] ?? b.tags).length
          break
        }
        case "potGain": {
          const ga = getGainLoss(a)
          const gb = getGainLoss(b)
          va = ga.gain
          vb = gb.gain
          break
        }
        case "potLoss": {
          const la = getGainLoss(a)
          const lb = getGainLoss(b)
          va = la.loss
          vb = lb.loss
          break
        }
        default:
          va = a.instrument
          vb = b.instrument
      }
      return compareValues(va, vb, sort.direction)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, instrumentFilter, directionFilter, sort, pricesByInstrument])

  const handleCancelConfirm = async (reason?: string) => {
    if (!cancelOrder) return
    const ok = await doCancelOrder(cancelOrder.sourceOrderId, reason)
    if (ok) setCancelOrder(null)
  }

  const handleCancelAll = async () => {
    setIsCancellingAll(true)
    try {
      await cancelAllOrders(undefined)
    } finally {
      setIsCancellingAll(false)
    }
  }

  const handleBulkCancel = async () => {
    const ids = filtered.filter((o) => bulk.isSelected(o.id)).map((o) => o.sourceOrderId)
    if (ids.length === 0) return
    setIsBulkCancelling(true)
    try {
      const result = await cancelAllOrders(ids)
      if (result.succeeded > 0) {
        bulk.clear()
      }
    } finally {
      setIsBulkCancelling(false)
    }
  }

  if (filtered.length === 0) {
    return <div className="text-muted-foreground py-12 text-center text-sm">No pending orders</div>
  }

  if (isMobile) {
    return (
      <>
        <div className="space-y-3">
          {filtered.map((order) => {
            const currentPrice = getCurrentPrice(order)
            return (
              <TradeCardMobile
                key={order.id}
                variant="pending"
                data={order}
                currentPrice={currentPrice}
                onViewDetails={() => setDrawerOrder(order)}
                onCancelOrder={() => setCancelOrder(order)}
              />
            )
          })}
        </div>
        <TradeDetailDrawer
          trade={drawerOrder ? { ...drawerOrder, _type: "pending" } : null}
          open={!!drawerOrder}
          onOpenChange={(open) => !open && setDrawerOrder(null)}
          currency={currency}
          currentPrice={drawerOrder ? getCurrentPrice(drawerOrder) : null}
          lastTick={drawerOrder ? (pricesByInstrument.get(drawerOrder.instrument) ?? null) : null}
          onCancelOrder={() => {
            if (drawerOrder) {
              setDrawerOrder(null)
              setCancelOrder(drawerOrder)
            }
          }}
          onTagMutated={onTagMutated}
        />
        <CancelOrderDialog
          order={cancelOrder}
          open={!!cancelOrder}
          onOpenChange={(open) => !open && setCancelOrder(null)}
          onConfirm={handleCancelConfirm}
          isLoading={actionLoading}
        />
      </>
    )
  }

  return (
    <>
      {filtered.length > 1 && (
        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive gap-1.5"
                disabled={isCancellingAll || actionLoading}
              >
                <Trash2 className="size-3.5" />
                {isCancellingAll ? "Cancelling…" : `Cancel All (${filtered.length})`}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel all {filtered.length} pending orders?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will cancel every pending order currently shown. This action cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Orders</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancelAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Cancel All Orders
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
                  bulk.isAllSelected(filtered)
                    ? true
                    : bulk.isSomeSelected(filtered)
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={() => bulk.toggleAll(filtered)}
                aria-label="Select all orders"
              />
            </TableHead>
            <SortableHead
              label="Pair"
              sortKey="instrument"
              currentSort={sort}
              onSort={handleSort}
            />
            <SortableHead
              label="Dir"
              sortKey="direction"
              currentSort={sort}
              onSort={handleSort}
              title="Direction (Long or Short)"
            />
            <SortableHead label="Source" sortKey="source" currentSort={sort} onSort={handleSort} />
            <SortableHead
              label="TF"
              sortKey="timeframe"
              currentSort={sort}
              onSort={handleSort}
              title="Timeframe"
            />
            <SortableHead
              label="Type"
              sortKey="orderType"
              currentSort={sort}
              onSort={handleSort}
              title="Order Type"
            />
            <SortableHead
              label="Entry"
              sortKey="entryPrice"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
              title="Entry Price"
            />
            <SortableHead
              label="Current"
              sortKey="currentPrice"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
              title="Current Price"
            />
            <SortableHead
              label="Distance"
              sortKey="distance"
              currentSort={sort}
              onSort={handleSort}
              title="Distance from current price to entry"
            />
            <SortableHead
              label="SL"
              sortKey="stopLoss"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
              title="Stop Loss"
            />
            <SortableHead
              label="TP"
              sortKey="takeProfit"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
              title="Take Profit"
            />
            <SortableHead
              label="Units"
              sortKey="units"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
            />
            <SortableHead
              label="R:R"
              sortKey="rr"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
              title="Risk / Reward Ratio"
            />
            <SortableHead
              label="Pot. Gain"
              sortKey="potGain"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
              title="Potential Gain if Take Profit is hit"
            />
            <SortableHead
              label="Pot. Loss"
              sortKey="potLoss"
              currentSort={sort}
              onSort={handleSort}
              className="text-right"
              title="Potential Loss if Stop Loss is hit"
            />
            <SortableHead
              label="Placed"
              sortKey="createdAt"
              currentSort={sort}
              onSort={handleSort}
            />
            <SortableHead
              label="Expires"
              sortKey="expires"
              currentSort={sort}
              onSort={handleSort}
            />
            <SortableHead label="Tags" sortKey="tags" currentSort={sort} onSort={handleSort} />
            <TableHead className="w-10">AI</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((order) => {
            const currentPrice = getCurrentPrice(order)
            const { gain, loss } = getGainLoss(order)

            return (
              <TableRow
                key={order.id}
                className="cursor-pointer select-none"
                onMouseDown={(e) => {
                  if (e.button === 0) setDrawerOrder(order)
                }}
              >
                <TableCell
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={bulk.isSelected(order.id)}
                    onCheckedChange={() => bulk.toggle(order.id)}
                    aria-label={`Select ${order.instrument.replace("_", "/")} order`}
                  />
                </TableCell>
                <TableCell className="text-xs font-medium">
                  {order.instrument.replace("_", "/")}
                </TableCell>
                <TableCell>
                  <DirectionBadge direction={order.direction} />
                </TableCell>
                <TableCell>
                  <SourceBadge source={order.source} />
                </TableCell>
                <TableCell
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <TimeframeSelect
                    value={order.timeframe}
                    onChange={async (tf) => {
                      await fetch(`/api/trades/${order.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ timeframe: tf }),
                      })
                      await refreshPositions()
                    }}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{order.orderType}</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {order.entryPrice}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {currentPrice !== null ? (
                    <AnimatedNumber value={currentPrice.toString()} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="min-w-[100px]">
                  <PendingProgressBar
                    instrument={order.instrument}
                    entryPrice={order.entryPrice}
                    currentPrice={currentPrice}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground text-right font-mono text-xs tabular-nums">
                  {order.stopLoss ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-right font-mono text-xs tabular-nums">
                  {order.takeProfit ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {order.units}
                </TableCell>
                <TableCell className="text-right">
                  <RiskRewardDisplay
                    direction={order.direction}
                    entryPrice={order.entryPrice}
                    stopLoss={order.stopLoss}
                    takeProfit={order.takeProfit}
                    instrument={order.instrument}
                    compact
                  />
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {gain !== null ? (
                    <span className="text-status-connected">+{formatCurrency(gain, currency)}</span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {loss !== null ? (
                    <span className="text-status-disconnected">
                      {formatCurrency(loss, currency)}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatRelativeTime(order.createdAt)}
                </TableCell>
                <TableCell className="text-xs">
                  {order.timeInForce === "GTD" && order.gtdTime ? (
                    <span className="text-muted-foreground">
                      {new Date(order.gtdTime).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Never</span>
                  )}
                </TableCell>
                <TableCell>
                  <TagBadges tags={tagsByTradeId[order.id] ?? order.tags} />
                </TableCell>
                <TableCell
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <AiAnalysisCell
                    latestAnalysis={latestAnalysisByTradeId?.[order.id]}
                    analysisCount={countByTradeId?.[order.id]}
                    activeProgress={activeAiByTradeId?.[order.id]}
                    onClick={() => setAiAnalysisOrder(order)}
                  />
                </TableCell>
                <TableCell
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="size-7 p-0">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDrawerOrder(order)}>
                        <Eye className="size-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAiAnalysisOrder(order)}>
                        <Sparkles className="size-4" />
                        AI Analysis
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => setCancelOrder(order)}>
                        <XCircle className="size-4" />
                        Cancel Order
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <TradeDetailDrawer
        trade={drawerOrder ? { ...drawerOrder, _type: "pending" } : null}
        open={!!drawerOrder}
        onOpenChange={(open) => !open && setDrawerOrder(null)}
        currency={currency}
        currentPrice={drawerOrder ? getCurrentPrice(drawerOrder) : null}
        lastTick={drawerOrder ? (pricesByInstrument.get(drawerOrder.instrument) ?? null) : null}
        onTagMutated={onTagMutated}
        onCancelOrder={() => {
          if (drawerOrder) {
            setDrawerOrder(null)
            setCancelOrder(drawerOrder)
          }
        }}
      />
      <CancelOrderDialog
        order={cancelOrder}
        open={!!cancelOrder}
        onOpenChange={(open) => !open && setCancelOrder(null)}
        onConfirm={handleCancelConfirm}
        isLoading={actionLoading}
      />
      <AiAnalysisSheet
        trade={aiAnalysisOrder}
        tradeStatus="pending"
        open={!!aiAnalysisOrder}
        onOpenChange={(open) => !open && setAiAnalysisOrder(null)}
      />
      <BulkActionBar
        count={bulk.count}
        type="pending"
        onCancel={handleBulkCancel}
        onClear={bulk.clear}
        isLoading={isBulkCancelling}
      />
    </>
  )
}
