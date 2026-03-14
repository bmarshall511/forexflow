"use client"

import { formatPnL, type PnLColorIntent } from "@fxflow/shared"
import { DataTile } from "@/components/ui/data-tile"
import { Trophy, Percent, TrendingUp, TrendingDown, Minus } from "lucide-react"

interface TodayResultsSectionProps {
  wins: number
  losses: number
  netPL: number
  winRate: string
  currency: string
}

const PNL_ICON: Record<PnLColorIntent, React.ElementType> = {
  positive: TrendingUp,
  negative: TrendingDown,
  neutral: Minus,
}

const VARIANT_MAP: Record<PnLColorIntent, "positive" | "negative" | "muted"> = {
  positive: "positive",
  negative: "negative",
  neutral: "muted",
}

export function TodayResultsSection({
  wins,
  losses,
  netPL,
  winRate,
  currency,
}: TodayResultsSectionProps) {
  const pnl = formatPnL(netPL, currency)
  const NetIcon = PNL_ICON[pnl.colorIntent]

  return (
    <div>
      <h3 className="text-muted-foreground mb-3 text-[11px] font-medium uppercase tracking-wider">
        Today&apos;s Results
      </h3>
      <div className="grid grid-cols-3 gap-2">
        <DataTile
          label="W / L"
          value={
            <>
              <span className="text-status-connected">{wins}W</span>
              {" / "}
              <span className="text-status-disconnected">{losses}L</span>
            </>
          }
          variant="muted"
          icon={<Trophy className="size-3.5" />}
        />
        <DataTile
          label="Win Rate"
          value={winRate}
          variant="muted"
          icon={<Percent className="size-3.5" />}
        />
        <DataTile
          label="Net P/L"
          value={pnl.formatted}
          variant={VARIANT_MAP[pnl.colorIntent]}
          icon={<NetIcon className="size-3.5" />}
        />
      </div>
    </div>
  )
}
