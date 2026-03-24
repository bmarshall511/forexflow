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
            "bg-muted/50 flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1",
            "hover:bg-accent/50 transition-colors",
            "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
          )}
          aria-label={`Positions: ${summary.pendingCount} pending, ${summary.openCount} open, ${summary.closedTodayCount} closed today`}
          title={`${summary.pendingCount} pending · ${summary.openCount} open · ${summary.closedTodayCount} closed today`}
        >
          {/* Pending */}
          <Clock className="text-status-warning size-3" aria-hidden="true" />
          <span className="text-foreground font-mono text-xs font-semibold tabular-nums">
            {summary.pendingCount}
          </span>
          <span className="@5xl/header:inline text-muted-foreground hidden text-[11px]">
            Pending
          </span>

          <span className="text-border text-[10px]" aria-hidden="true">
            &middot;
          </span>

          {/* Open */}
          <TrendingUp className="text-status-connected size-3" aria-hidden="true" />
          <span className="text-foreground font-mono text-xs font-semibold tabular-nums">
            {summary.openCount}
          </span>
          <span className="@5xl/header:inline text-muted-foreground hidden text-[11px]">Open</span>

          <span className="text-border text-[10px]" aria-hidden="true">
            &middot;
          </span>

          {/* Closed today */}
          <CheckCircle2 className="text-muted-foreground size-3" aria-hidden="true" />
          <span className="text-foreground font-mono text-xs font-semibold tabular-nums">
            {summary.closedTodayCount}
          </span>
          <span className="@5xl/header:inline text-muted-foreground hidden text-[11px]">Today</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Tabs defaultValue="open">
          <TabsList variant="line" className="border-border w-full border-b px-2 pt-2">
            <TabsTrigger value="pending" className="text-xs">
              Pending
              {summary.pendingCount > 0 && (
                <span className="bg-status-warning/15 text-status-warning ml-1 inline-flex size-4 items-center justify-center rounded-full text-[10px] font-semibold">
                  {summary.pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="open" className="text-xs">
              Open
              {summary.openCount > 0 && (
                <span className="bg-status-connected/15 text-status-connected ml-1 inline-flex size-4 items-center justify-center rounded-full text-[10px] font-semibold">
                  {summary.openCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="closed" className="text-xs">
              Closed
              {summary.closedTodayCount > 0 && (
                <span className="bg-muted text-muted-foreground ml-1 inline-flex size-4 items-center justify-center rounded-full text-[10px] font-semibold">
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
