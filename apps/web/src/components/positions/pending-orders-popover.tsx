"use client"

import type { PendingOrderData, PositionPriceTick } from "@fxflow/types"
import { calculateDistanceInfo, formatPips } from "@fxflow/shared"
import { DirectionBadge } from "./direction-badge"
import Link from "next/link"

interface PendingOrdersPopoverProps {
  orders: PendingOrderData[]
  pricesByInstrument: Map<string, PositionPriceTick>
}

export function PendingOrdersPopover({ orders, pricesByInstrument }: PendingOrdersPopoverProps) {
  if (orders.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Pending Orders</h4>
        <p className="text-xs text-muted-foreground">No pending orders</p>
      </div>
    )
  }

  // Sort by distance to fill (closest first)
  const sorted = [...orders]
    .map((order) => {
      const tick = pricesByInstrument.get(order.instrument)
      const currentPrice = tick ? (order.direction === "long" ? tick.ask : tick.bid) : null
      const distance = currentPrice
        ? calculateDistanceInfo(order.instrument, currentPrice, order.entryPrice)
        : null
      return { order, currentPrice, distance }
    })
    .sort((a, b) => (a.distance?.pips ?? Infinity) - (b.distance?.pips ?? Infinity))
    .slice(0, 5)

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Pending Orders</h4>

      <div className="space-y-2">
        {sorted.map(({ order, distance }) => (
          <div key={order.id} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-medium truncate">
                {order.instrument.replace("_", "/")}
              </span>
              <DirectionBadge direction={order.direction} />
            </div>
            <div className="flex items-center gap-2 text-right shrink-0">
              <span className="text-xs font-mono tabular-nums text-muted-foreground">
                @ {order.entryPrice}
              </span>
              {distance && (
                <span className="text-[10px] font-mono tabular-nums text-status-warning">
                  {formatPips(distance.pips)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/positions?tab=pending"
        className="block text-xs text-primary hover:underline pt-1 border-t border-border"
      >
        View all {orders.length} pending &rarr;
      </Link>
    </div>
  )
}
