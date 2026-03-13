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
      className={cn(
        "flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1",
        className,
      )}
      aria-label={`${count} ${label}`}
    >
      {icon}
      <span className="font-mono text-xs tabular-nums font-semibold text-foreground">
        {count}
      </span>
      <span className="hidden xl:inline text-[11px] text-muted-foreground">{label}</span>
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
    <div className="hidden md:flex items-center gap-1.5">
      <IndicatorPill
        icon={<Clock className="size-3 text-status-warning" />}
        label="Pending"
        count={pendingOrders}
      />
      <IndicatorPill
        icon={<TrendingUp className="size-3 text-status-connected" />}
        label="Open"
        count={openPositions}
      />
      <IndicatorPill
        icon={<CheckCircle2 className="size-3 text-muted-foreground" />}
        label="Closed"
        count={closedPositions}
      />
    </div>
  )
}
