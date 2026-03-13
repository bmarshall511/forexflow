"use client"

import type { PositionsSummary } from "@fxflow/types"
import { formatPnL, type PnLColorIntent } from "@fxflow/shared"
import { DataTile } from "@/components/ui/data-tile"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Clock,
  CheckCircle2,
} from "lucide-react"

interface PositionSummarySectionProps {
  summary: PositionsSummary
  totalExposure: number
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

export function PositionSummarySection({
  summary,
  totalExposure,
  currency,
}: PositionSummarySectionProps) {
  const exposure = formatPnL(totalExposure, currency)
  const ExposureIcon = PNL_ICON[exposure.colorIntent]

  return (
    <div>
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Positions
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <DataTile
          label="Total Exposure"
          value={exposure.formatted}
          variant={VARIANT_MAP[exposure.colorIntent]}
          icon={<ExposureIcon className="size-3.5" />}
          wide
        />
        <DataTile label="Open" value={summary.openCount} variant="muted" icon={<BarChart3 className="size-3.5" />} />
        <DataTile label="Pending" value={summary.pendingCount} variant="muted" icon={<Clock className="size-3.5" />} />
        <DataTile
          label="Closed Today"
          value={summary.closedTodayCount}
          variant="muted"
          icon={<CheckCircle2 className="size-3.5" />}
          className="col-span-2 sm:col-span-1"
        />
      </div>
    </div>
  )
}
