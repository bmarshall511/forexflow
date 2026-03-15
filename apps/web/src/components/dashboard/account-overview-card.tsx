"use client"

import { useMemo } from "react"
import { useAccountOverview } from "@/hooks/use-account-overview"
import { usePositions } from "@/hooks/use-positions"
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Settings2, AlertCircle, Activity, WifiOff } from "lucide-react"
import Link from "next/link"
import { AccountBalanceSection } from "./account-balance-section"
import { TodayPnLSection } from "./today-pnl-section"
import { PnLPeriodsSection } from "./pnl-periods-section"
import { AccountDetailsSection } from "./account-details-section"

function AccountOverviewSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading account data" role="status">
      {/* Balance skeleton */}
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
      {/* Margin bar skeleton */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-2.5 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      {/* Divider */}
      <div className="border-border border-t" />
      {/* Today cards skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-12" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
      {/* Divider */}
      <div className="border-border border-t" />
      {/* Historical P&L skeleton */}
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-24" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
      {/* Divider */}
      <div className="border-border border-t" />
      {/* Details skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function AccountOverviewCard() {
  const { data, isLoaded, isConfigured, hasError, errorMessage, tradingMode } = useAccountOverview()
  const { openWithPrices } = usePositions()

  // Use live-streamed prices for unrealized P&L (same source as Positions card)
  const liveUnrealizedPL = useMemo(
    () => openWithPrices.reduce((sum, t) => sum + t.unrealizedPL, 0),
    [openWithPrices],
  )

  // State: Unconfigured
  if (!isConfigured) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="bg-muted mb-4 flex size-12 items-center justify-center rounded-full">
              <Settings2 className="text-muted-foreground size-5" />
            </div>
            <p className="text-sm font-medium">No OANDA Credentials</p>
            <p className="text-muted-foreground mt-1 max-w-[240px] text-xs">
              Connect your OANDA account to see live trading data and P&L metrics.
            </p>
            <Link
              href="/settings/oanda"
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-medium transition-colors"
            >
              <Settings2 className="size-3.5" />
              Connect Account
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // State: Error (health check ran but failed — show immediately, don't wait for data)
  if (hasError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4" />
            Account Overview
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-destructive gap-1 text-[10px] font-medium">
              <WifiOff className="size-3" />
              Error
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="bg-destructive/10 mb-4 flex size-12 items-center justify-center rounded-full">
              <AlertCircle className="text-destructive size-5" />
            </div>
            <p className="text-destructive text-sm font-medium">Connection Failed</p>
            <p className="text-muted-foreground mt-1 max-w-[280px] text-xs">
              Unable to connect to your OANDA account. Please verify your credentials.
            </p>
            {errorMessage && (
              <p className="bg-destructive/5 text-destructive/80 mt-2 max-w-[320px] rounded-md px-3 py-2 font-mono text-[11px]">
                {errorMessage}
              </p>
            )}
            <Link
              href="/settings/oanda"
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-medium transition-colors"
            >
              Check Settings
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // State: Loading
  if (!isLoaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4" />
            Account Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AccountOverviewSkeleton />
        </CardContent>
      </Card>
    )
  }

  // State: Data
  const { summary, pnl, lastUpdated } = data!
  const currency = summary.currency

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4" />
          Account Overview
        </CardTitle>
        <CardAction>
          <Badge variant="outline" className="text-muted-foreground gap-1 text-[10px] font-medium">
            <span className="bg-status-connected size-1.5 rounded-full" />
            {tradingMode === "practice" ? "Practice" : "Live"} {summary.alias || summary.accountId}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-6">
        <AccountBalanceSection
          summary={summary}
          currency={currency}
          liveUnrealizedPL={liveUnrealizedPL}
        />

        <div className="border-border border-t" />

        <TodayPnLSection
          today={pnl.today}
          yesterday={pnl.yesterday}
          unrealizedPL={liveUnrealizedPL}
          currency={currency}
        />

        <div className="border-border border-t" />

        <PnLPeriodsSection pnl={pnl} currency={currency} />

        <div className="border-border border-t" />

        <AccountDetailsSection summary={summary} currency={currency} lastUpdated={lastUpdated} />
      </CardContent>
    </Card>
  )
}
