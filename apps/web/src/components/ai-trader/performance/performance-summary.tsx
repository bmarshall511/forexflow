"use client"

import { DataTile } from "@/components/ui/data-tile"
import { BarChart3, Target, TrendingUp, Percent, DollarSign, ArrowDownRight } from "lucide-react"
import type { AiTraderStrategyPerformanceData } from "@fxflow/types"

interface Props {
  overall: AiTraderStrategyPerformanceData | null
}

function fmt(v: number, decimals = 2): string {
  return v.toFixed(decimals)
}

export function PerformanceSummary({ overall }: Props) {
  const o = overall
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <DataTile
        label="Total Trades"
        value={String(o?.totalTrades ?? 0)}
        icon={<BarChart3 className="size-3" />}
      />
      <DataTile
        label="Win Rate"
        value={o ? `${Math.round(o.winRate * 100)}%` : "--"}
        icon={<Target className="size-3" />}
        variant={o && o.winRate >= 0.5 ? "positive" : o && o.winRate > 0 ? "negative" : "default"}
      />
      <DataTile
        label="Total P&L"
        value={o ? `$${fmt(o.totalPL)}` : "--"}
        icon={<DollarSign className="size-3" />}
        variant={o && o.totalPL > 0 ? "positive" : o && o.totalPL < 0 ? "negative" : "default"}
      />
      <DataTile
        label="Profit Factor"
        value={o ? fmt(o.profitFactor) : "--"}
        icon={<TrendingUp className="size-3" />}
        variant={
          o && o.profitFactor >= 1.5 ? "positive" : o && o.profitFactor > 0 ? "default" : "muted"
        }
      />
      <DataTile
        label="Expectancy"
        value={o ? `$${fmt(o.expectancy)}` : "--"}
        icon={<Percent className="size-3" />}
        variant={
          o && o.expectancy > 0 ? "positive" : o && o.expectancy < 0 ? "negative" : "default"
        }
      />
      <DataTile
        label="Max Drawdown"
        value={o ? `$${fmt(o.maxDrawdown)}` : "--"}
        icon={<ArrowDownRight className="size-3" />}
        variant={o && o.maxDrawdown > 0 ? "negative" : "default"}
      />
    </div>
  )
}
