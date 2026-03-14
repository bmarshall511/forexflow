"use client"

import type { PeriodPnL } from "@fxflow/types"
import { formatPnL, type PnLColorIntent } from "@fxflow/shared"
import { DataTile } from "@/components/ui/data-tile"
import { TrendingUp, TrendingDown, Minus, CheckCircle2 } from "lucide-react"

interface TodayPnLSectionProps {
  today: PeriodPnL
  yesterday: PeriodPnL
  unrealizedPL: number
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

export function TodayPnLSection({
  today,
  yesterday,
  unrealizedPL,
  currency,
}: TodayPnLSectionProps) {
  const unrealized = formatPnL(unrealizedPL, currency)
  const realized = formatPnL(today.realizedPL, currency)
  const financing = formatPnL(yesterday.financing, currency)

  const UnrealizedIcon = PNL_ICON[unrealized.colorIntent]
  const RealizedIcon = PNL_ICON[realized.colorIntent]
  const FinancingIcon = PNL_ICON[financing.colorIntent]

  return (
    <div>
      <h3 className="text-muted-foreground mb-3 text-[11px] font-medium uppercase tracking-wider">
        Today
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <DataTile
          label="Unrealized"
          value={unrealized.formatted}
          variant={VARIANT_MAP[unrealized.colorIntent]}
          icon={<UnrealizedIcon className="size-3.5" />}
        />
        <DataTile
          label="Realized"
          value={realized.formatted}
          variant={VARIANT_MAP[realized.colorIntent]}
          icon={<RealizedIcon className="size-3.5" />}
        />
        <DataTile
          label="Financing (Yest.)"
          value={financing.formatted}
          variant={VARIANT_MAP[financing.colorIntent]}
          icon={<FinancingIcon className="size-3.5" />}
        />
        <DataTile
          label="Closed Trades"
          value={today.tradeCount >= 0 ? today.tradeCount : 0}
          variant="muted"
          icon={<CheckCircle2 className="size-3.5" />}
        />
      </div>
    </div>
  )
}
