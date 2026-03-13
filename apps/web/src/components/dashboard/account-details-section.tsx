"use client"

import type { AccountSummaryData } from "@fxflow/types"
import { formatCurrency } from "@fxflow/shared"
import { useRelativeTime } from "@/hooks/use-relative-time"
import {
  Landmark,
  ArrowDownToLine,
  Banknote,
  Hash,
} from "lucide-react"

interface AccountDetailsSectionProps {
  summary: AccountSummaryData
  currency: string
  lastUpdated: string
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <Icon className="size-3.5 shrink-0 text-muted-foreground/60" />
      <span className="flex-1 text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium tabular-nums">{value}</span>
    </div>
  )
}

export function AccountDetailsSection({
  summary,
  currency,
  lastUpdated,
}: AccountDetailsSectionProps) {
  const relativeTime = useRelativeTime(lastUpdated)

  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Account Details
      </h3>
      <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        <DetailItem icon={Hash} label="Account" value={summary.alias || summary.accountId} />
        <DetailItem
          icon={Landmark}
          label="Net Asset Value"
          value={formatCurrency(summary.nav, currency)}
        />
        <DetailItem
          icon={Banknote}
          label="Withdrawal Limit"
          value={formatCurrency(summary.withdrawalLimit, currency)}
        />
        <DetailItem
          icon={ArrowDownToLine}
          label="Position Value"
          value={formatCurrency(summary.positionValue, currency)}
        />
      </div>
      <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground/60">
        <span className="size-1.5 rounded-full bg-status-connected animate-pulse" />
        Live — updated {relativeTime}
      </div>
    </div>
  )
}
