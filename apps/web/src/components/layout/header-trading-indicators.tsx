"use client"

import { Clock, TrendingUp, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface IndicatorPillProps {
  icon: React.ReactNode
  label: string
  count: number
  className?: string
}

function IndicatorPill({ icon, label, count, className }: IndicatorPillProps) {
  return (
    <div
      className={cn("bg-muted/50 flex items-center gap-1.5 rounded-md px-2.5 py-1", className)}
      aria-label={`${count} ${label}`}
    >
      {icon}
      <span className="text-foreground font-mono text-xs font-semibold tabular-nums">{count}</span>
      <span className="text-muted-foreground hidden text-[11px] xl:inline">{label}</span>
    </div>
  )
}

interface HeaderTradingIndicatorsProps {
  pendingOrders?: number
  openPositions?: number
  closedPositions?: number
}

export function HeaderTradingIndicators({
  pendingOrders = 0,
  openPositions = 0,
  closedPositions = 0,
}: HeaderTradingIndicatorsProps) {
  return (
    <div className="hidden items-center gap-1.5 md:flex">
      <IndicatorPill
        icon={<Clock className="text-status-warning size-3" />}
        label="Pending"
        count={pendingOrders}
      />
      <IndicatorPill
        icon={<TrendingUp className="text-status-connected size-3" />}
        label="Open"
        count={openPositions}
      />
      <IndicatorPill
        icon={<CheckCircle2 className="text-muted-foreground size-3" />}
        label="Closed"
        count={closedPositions}
      />
    </div>
  )
}
