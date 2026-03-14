import type { PriceAlertStatus } from "@fxflow/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const statusConfig: Record<PriceAlertStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-emerald-500/15 text-emerald-500 dark:bg-emerald-500/20",
  },
  triggered: {
    label: "Triggered",
    className: "bg-amber-500/15 text-amber-500 dark:bg-amber-500/20",
  },
  expired: {
    label: "Expired",
    className: "bg-muted text-muted-foreground",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-500/15 text-red-500 dark:bg-red-500/20",
  },
}

export function AlertStatusBadge({ status }: { status: PriceAlertStatus }) {
  const config = statusConfig[status]
  return (
    <Badge variant="outline" className={cn("border-transparent", config.className)}>
      {config.label}
    </Badge>
  )
}
