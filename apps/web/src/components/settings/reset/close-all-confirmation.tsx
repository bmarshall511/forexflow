"use client"

import { useMemo } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DirectionBadge } from "@/components/positions/direction-badge"
import { SourceBadge } from "@/components/positions/source-badge"
import { formatCurrency } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import type { OpenTradeData, PendingOrderData } from "@fxflow/types"
import { TrendingDown, TrendingUp, Minus, AlertTriangle } from "lucide-react"

interface CloseAllConfirmationProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "trades" to close open trades, "orders" to cancel pending orders */
  variant: "trades" | "orders"
  trades?: OpenTradeData[]
  orders?: PendingOrderData[]
  currency?: string
  onConfirm: () => void
}

function PnlIcon({ value }: { value: number }) {
  if (value > 0) return <TrendingUp className="size-4 text-green-500" />
  if (value < 0) return <TrendingDown className="size-4 text-red-500" />
  return <Minus className="text-muted-foreground size-4" />
}

export function CloseAllConfirmation({
  open,
  onOpenChange,
  variant,
  trades = [],
  orders = [],
  currency = "USD",
  onConfirm,
}: CloseAllConfirmationProps) {
  const isTradeMode = variant === "trades"
  const items = isTradeMode ? trades : orders
  const count = items.length

  const totalPnL = useMemo(() => trades.reduce((sum, t) => sum + t.unrealizedPL, 0), [trades])

  const winners = useMemo(() => trades.filter((t) => t.unrealizedPL > 0), [trades])
  const losers = useMemo(() => trades.filter((t) => t.unrealizedPL < 0), [trades])

  if (count === 0) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isTradeMode
              ? `Close ${count} open ${count === 1 ? "trade" : "trades"}?`
              : `Cancel ${count} pending ${count === 1 ? "order" : "orders"}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isTradeMode
              ? "All trades will close at the current market price. Profit and loss shown below are estimates based on the last known price."
              : "All pending orders will be removed. No trades will be opened from these orders."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Summary card for trades */}
        {isTradeMode && trades.length > 0 && (
          <div className="border-border/50 rounded-lg border p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Estimated Result
              </span>
              <div className="flex items-center gap-1.5">
                <PnlIcon value={totalPnL} />
                <span
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    totalPnL >= 0 ? "text-green-500" : "text-red-500",
                  )}
                >
                  {formatCurrency(totalPnL, currency)}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-background/60 rounded-md p-2">
                <p className="text-muted-foreground text-[10px] uppercase">In Profit</p>
                <p className="text-sm font-semibold text-green-500">{winners.length}</p>
              </div>
              <div className="bg-background/60 rounded-md p-2">
                <p className="text-muted-foreground text-[10px] uppercase">At Loss</p>
                <p className="text-sm font-semibold text-red-500">{losers.length}</p>
              </div>
              <div className="bg-background/60 rounded-md p-2">
                <p className="text-muted-foreground text-[10px] uppercase">Breakeven</p>
                <p className="text-sm font-semibold">
                  {trades.length - winners.length - losers.length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Individual items list */}
        <div className="max-h-[40vh] space-y-1 overflow-y-auto">
          {isTradeMode
            ? trades.map((t) => <TradeRow key={t.id} trade={t} currency={currency} />)
            : orders.map((o) => <OrderRow key={o.id} order={o} />)}
        </div>

        {/* Warning */}
        <div className="flex gap-2 rounded-md bg-amber-500/10 p-2.5 text-amber-500">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="text-xs leading-relaxed">
            {isTradeMode
              ? "This cannot be undone. Once closed, profit or loss is locked in permanently."
              : "Cancelled orders cannot be restored. You'll need to place new orders manually."}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{isTradeMode ? "Keep Trades" : "Keep Orders"}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isTradeMode ? `Close ${count} Trades` : `Cancel ${count} Orders`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function TradeRow({ trade, currency }: { trade: OpenTradeData; currency: string }) {
  const pair = trade.instrument.replace("_", "/")
  const pnl = trade.unrealizedPL
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{pair}</span>
        <DirectionBadge direction={trade.direction} />
        <SourceBadge source={trade.source} />
      </div>
      <span
        className={cn(
          "font-mono text-sm font-semibold tabular-nums",
          pnl >= 0 ? "text-green-500" : "text-red-500",
        )}
      >
        {formatCurrency(pnl, currency)}
      </span>
    </div>
  )
}

function OrderRow({ order }: { order: PendingOrderData }) {
  const pair = order.instrument.replace("_", "/")
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{pair}</span>
        <DirectionBadge direction={order.direction} />
        <span className="text-muted-foreground text-xs">{order.orderType.replace("_", " ")}</span>
      </div>
      <span className="text-muted-foreground font-mono text-xs tabular-nums">
        @ {order.entryPrice}
      </span>
    </div>
  )
}
