"use client"

import type { PendingOrderData } from "@fxflow/types"
import { Badge } from "@/components/ui/badge"
import { PendingProgressBar } from "@/components/positions/progress-bar-pending"
import { ProximityTradeRow } from "./proximity-trade-row"
import type { ProximityOrder } from "./use-positions-dashboard"
import Link from "next/link"

interface ProximityFillingSectionProps {
  orders: ProximityOrder[]
  onSelectTrade: (order: PendingOrderData) => void
}

export function ProximityFillingSection({ orders, onSelectTrade }: ProximityFillingSectionProps) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
          Near Filling
        </h3>
        {orders.length > 0 && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            {orders.length}
          </Badge>
        )}
      </div>

      {orders.length === 0 ? (
        <p className="text-muted-foreground py-3 text-center text-xs">No orders near fill</p>
      ) : (
        <div className="space-y-0.5">
          {orders.map((item) => {
            const { order, fillPercent, currentPrice } = item
            const pair = order.instrument.replace("_", "/")

            return (
              <ProximityTradeRow
                key={order.id}
                instrument={order.instrument}
                direction={order.direction}
                value={`${Math.round(fillPercent)}%`}
                valueClassName="text-status-warning"
                detail={`${order.orderType.replace("_", " ")}`}
                detailClassName="text-muted-foreground"
                onClick={() => onSelectTrade(order)}
                ariaLabel={`View ${pair} ${order.direction} pending order details — ${Math.round(fillPercent)}% to fill`}
              >
                <PendingProgressBar
                  instrument={order.instrument}
                  entryPrice={order.entryPrice}
                  currentPrice={currentPrice}
                  className="mt-0.5"
                />
              </ProximityTradeRow>
            )
          })}

          <Link
            href="/positions?tab=pending"
            className="text-primary mt-1 block text-center text-[10px] font-medium hover:underline"
            aria-label="View all pending orders"
          >
            View all pending orders
          </Link>
        </div>
      )}
    </div>
  )
}
