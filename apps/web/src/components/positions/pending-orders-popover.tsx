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
        <p className="text-muted-foreground text-xs">No pending orders</p>
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
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-xs font-medium">
                {order.instrument.replace("_", "/")}
              </span>
              <DirectionBadge direction={order.direction} />
            </div>
            <div className="flex shrink-0 items-center gap-2 text-right">
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                @ {order.entryPrice}
              </span>
              {distance && (
                <span className="text-status-warning font-mono text-[10px] tabular-nums">
                  {formatPips(distance.pips)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/positions?tab=pending"
        className="text-primary border-border block border-t pt-1 text-xs hover:underline"
      >
        View all {orders.length} pending &rarr;
      </Link>
    </div>
  )
}
