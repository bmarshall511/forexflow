"use client"

import { Clock, TrendingUp, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePositions } from "@/hooks/use-positions"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PendingOrdersPopover } from "@/components/positions/pending-orders-popover"
import { OpenTradesPopover } from "@/components/positions/open-trades-popover"
import { ClosedTradesPopover } from "@/components/positions/closed-trades-popover"

export function HeaderPositions() {
  const { accountOverview } = useDaemonStatus()
  const { positions, summary, pricesByInstrument, openWithPrices } = usePositions()

  const currency = accountOverview?.summary.currency ?? "USD"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-1 whitespace-nowrap",
            "hover:bg-accent/50 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-label={`Positions: ${summary.pendingCount} pending, ${summary.openCount} open, ${summary.closedTodayCount} closed today`}
        >
          {/* Pending */}
          <Clock className="size-3 text-status-warning" aria-hidden="true" />
          <span className="font-mono text-xs tabular-nums font-semibold text-foreground">
            {summary.pendingCount}
          </span>
          <span className="hidden @5xl/header:inline text-[11px] text-muted-foreground">Pending</span>

          <span className="text-border text-[10px]" aria-hidden="true">&middot;</span>

          {/* Open */}
          <TrendingUp className="size-3 text-status-connected" aria-hidden="true" />
          <span className="font-mono text-xs tabular-nums font-semibold text-foreground">
            {summary.openCount}
          </span>
          <span className="hidden @5xl/header:inline text-[11px] text-muted-foreground">Open</span>

          <span className="text-border text-[10px]" aria-hidden="true">&middot;</span>

          {/* Closed */}
          <CheckCircle2 className="size-3 text-muted-foreground" aria-hidden="true" />
          <span className="font-mono text-xs tabular-nums font-semibold text-foreground">
            {summary.closedTodayCount}
          </span>
          <span className="hidden @5xl/header:inline text-[11px] text-muted-foreground">Closed</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Tabs defaultValue="open">
          <TabsList variant="line" className="w-full border-b border-border px-2 pt-2">
            <TabsTrigger value="pending" className="text-xs">
              Pending
              {summary.pendingCount > 0 && (
                <span className="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-status-warning/15 text-[10px] font-semibold text-status-warning">
                  {summary.pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="open" className="text-xs">
              Open
              {summary.openCount > 0 && (
                <span className="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-status-connected/15 text-[10px] font-semibold text-status-connected">
                  {summary.openCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="closed" className="text-xs">
              Closed
              {summary.closedTodayCount > 0 && (
                <span className="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                  {summary.closedTodayCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="p-3">
            <TabsContent value="pending">
              <PendingOrdersPopover
                orders={positions?.pending ?? []}
                pricesByInstrument={pricesByInstrument}
              />
            </TabsContent>
            <TabsContent value="open">
              <OpenTradesPopover trades={openWithPrices} currency={currency} />
            </TabsContent>
            <TabsContent value="closed">
              <ClosedTradesPopover trades={positions?.closed ?? []} currency={currency} />
            </TabsContent>
          </div>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}
