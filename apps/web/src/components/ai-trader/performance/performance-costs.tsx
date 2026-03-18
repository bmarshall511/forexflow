"use client"

import { DataTile } from "@/components/ui/data-tile"
import { ProportionBar } from "@/components/ui/data-tile"
import { DollarSign, TrendingUp, Zap } from "lucide-react"
import type { AiTraderCostStats } from "@fxflow/db"

interface Props {
  costs: AiTraderCostStats | null
}

export function PerformanceCosts({ costs }: Props) {
  if (!costs || costs.tradeCount === 0) {
    return <div className="text-muted-foreground py-8 text-center text-sm">No cost data yet.</div>
  }

  return (
    <section aria-label="AI cost efficiency">
      <h3 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
        Cost Efficiency
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DataTile
          label="Total AI Spend"
          value={`$${costs.totalCost.toFixed(4)}`}
          icon={<DollarSign className="size-3" />}
        />
        <DataTile
          label="Cost per Trade"
          value={`$${costs.costPerTrade.toFixed(4)}`}
          icon={<Zap className="size-3" />}
        />
        <DataTile
          label="P&L Return"
          value={`$${costs.totalPL.toFixed(2)}`}
          icon={<TrendingUp className="size-3" />}
          variant={costs.totalPL > 0 ? "positive" : costs.totalPL < 0 ? "negative" : "default"}
        />
        <DataTile
          label="ROI on AI"
          value={`${(costs.roi * 100).toFixed(0)}%`}
          subtitle={costs.roi > 0 ? "P&L earned per $1 AI spend" : undefined}
          icon={<TrendingUp className="size-3" />}
          variant={costs.roi > 1 ? "positive" : costs.roi > 0 ? "default" : "negative"}
        />
      </div>
      <div className="mt-4">
        <ProportionBar
          segments={[
            { value: costs.tier2Total, color: "#6366f1", label: "Tier 2 (Haiku)" },
            { value: costs.tier3Total, color: "#8b5cf6", label: "Tier 3 (Sonnet)" },
          ]}
        />
      </div>
    </section>
  )
}
