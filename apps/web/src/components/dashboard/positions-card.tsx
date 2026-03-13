"use client"

import { useState, useMemo } from "react"
import type { OpenTradeData, PendingOrderData, ClosedTradeData } from "@fxflow/types"
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Settings2, Crosshair, AlertCircle, WifiOff } from "lucide-react"
import Link from "next/link"
import { TradeDetailDrawer } from "@/components/positions/trade-detail-drawer"
import { CloseTradeDialog } from "@/components/positions/close-trade-dialog"
import { useTradeActions } from "@/hooks/use-trade-actions"
import { usePositionsDashboard } from "./use-positions-dashboard"
import { PositionSummarySection } from "./position-summary-section"
import { ProximityClosingSection } from "./proximity-closing-section"
import { ProximityFillingSection } from "./proximity-filling-section"
import { BestWorstSection } from "./best-worst-section"
import { TodayResultsSection } from "./today-results-section"
import { RecentActivitySection } from "./recent-activity-section"

// ─── Tagged union for the drawer ────────────────────────────────────────────

type TradeUnion =
  | (PendingOrderData & { _type: "pending" })
  | (OpenTradeData & { _type: "open" })
  | (ClosedTradeData & { _type: "closed" })

// ─── Skeleton ───────────────────────────────────────────────────────────────

function PositionsCardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading positions data" role="status">
      {/* Summary skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </div>
      <div className="border-t border-border" />
      {/* Near closing skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
      <div className="border-t border-border" />
      {/* Best/worst skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
      <div className="border-t border-border" />
      {/* Today results skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PositionsDashboardCard() {
  const {
    summary,
    totalExposure,
    currency,
    tradesNearClosing,
    ordersNearFilling,
    bestPerformer,
    worstPerformer,
    todayWins,
    todayLosses,
    todayNetPL,
    todayWinRate,
    recentClosed,
    isLoaded,
    isConfigured,
    hasError,
    errorMessage,
    openWithPrices,
    pricesByInstrument,
  } = usePositionsDashboard()

  const { closeTrade, isLoading: isActionsLoading } = useTradeActions()

  // Drawer state
  const [drawerTrade, setDrawerTrade] = useState<TradeUnion | null>(null)
  const [closeTarget, setCloseTarget] = useState<OpenTradeData | null>(null)

  // Keep drawer trade synced with live prices
  const liveDrawerTrade = useMemo((): TradeUnion | null => {
    if (!drawerTrade || drawerTrade._type !== "open") return drawerTrade
    const live = openWithPrices.find((t) => t.id === drawerTrade.id)
    return live ? { ...live, _type: "open" as const } : drawerTrade
  }, [drawerTrade, openWithPrices])

  // Current price for pending orders in drawer
  const drawerCurrentPrice = useMemo((): number | null => {
    if (!drawerTrade || drawerTrade._type !== "pending") return null
    const tick = pricesByInstrument.get(drawerTrade.instrument)
    if (!tick) return null
    return drawerTrade.direction === "long" ? tick.ask : tick.bid
  }, [drawerTrade, pricesByInstrument])

  // Selection callbacks
  const selectOpen = (trade: OpenTradeData) =>
    setDrawerTrade({ ...trade, _type: "open" })
  const selectPending = (order: PendingOrderData) =>
    setDrawerTrade({ ...order, _type: "pending" })
  const selectClosed = (trade: ClosedTradeData) =>
    setDrawerTrade({ ...trade, _type: "closed" })

  const handleCloseTrade = async (units?: number) => {
    if (!closeTarget) return
    const ok = await closeTrade(closeTarget.sourceTradeId, units)
    if (ok) {
      setCloseTarget(null)
      setDrawerTrade(null)
    }
  }

  // ── Unconfigured state ──────────────────────────────────────────────────
  if (!isConfigured) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <Settings2 className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No Position Data</p>
            <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
              Connect your OANDA account to see live positions.
            </p>
            <Link
              href="/settings/oanda"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Settings2 className="size-3.5" />
              Connect Account
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Error state (health check ran but failed) ─────────────────────────
  if (hasError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="size-4" />
            Positions
          </CardTitle>
          <CardAction>
            <Badge
              variant="outline"
              className="gap-1 text-[10px] font-medium text-destructive"
            >
              <WifiOff className="size-3" />
              Error
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-5 text-destructive" />
            </div>
            <p className="text-sm font-medium text-destructive">
              Connection Failed
            </p>
            <p className="mt-1 max-w-[280px] text-xs text-muted-foreground">
              Unable to load positions from OANDA. Please verify your credentials.
            </p>
            {errorMessage && (
              <p className="mt-2 max-w-[320px] rounded-md bg-destructive/5 px-3 py-2 text-[11px] font-mono text-destructive/80">
                {errorMessage}
              </p>
            )}
            <Link
              href="/settings/oanda"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Check Settings
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Loading state ───────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="size-4" />
            Positions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PositionsCardSkeleton />
        </CardContent>
      </Card>
    )
  }

  // ── Data state ──────────────────────────────────────────────────────────
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="size-4" />
            Positions
          </CardTitle>
          <CardAction>
            <Badge
              variant="outline"
              className="gap-1 text-[10px] font-medium text-muted-foreground"
            >
              {summary.openCount + summary.pendingCount} active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-6">
          <PositionSummarySection
            summary={summary}
            totalExposure={totalExposure}
            currency={currency}
          />

          <div className="border-t border-border" />

          <ProximityClosingSection
            trades={tradesNearClosing}
            currency={currency}
            onSelectTrade={selectOpen}
          />

          <div className="border-t border-border" />

          <ProximityFillingSection
            orders={ordersNearFilling}
            onSelectTrade={selectPending}
          />

          <div className="border-t border-border" />

          <BestWorstSection
            best={bestPerformer}
            worst={worstPerformer}
            currency={currency}
            onSelectTrade={selectOpen}
          />

          <div className="border-t border-border" />

          <TodayResultsSection
            wins={todayWins}
            losses={todayLosses}
            netPL={todayNetPL}
            winRate={todayWinRate}
            currency={currency}
          />

          <div className="border-t border-border" />

          <RecentActivitySection
            trades={recentClosed}
            currency={currency}
            onSelectTrade={selectClosed}
          />
        </CardContent>
      </Card>

      {/* Drawer + Close dialog rendered once */}
      <TradeDetailDrawer
        trade={liveDrawerTrade}
        open={!!drawerTrade}
        onOpenChange={(open) => {
          if (!open) setDrawerTrade(null)
        }}
        currency={currency}
        currentPrice={drawerCurrentPrice}
        onCloseTrade={
          liveDrawerTrade?._type === "open"
            ? () => {
                const t = liveDrawerTrade as OpenTradeData & { _type: "open" }
                setCloseTarget(t)
              }
            : undefined
        }
      />

      <CloseTradeDialog
        trade={closeTarget}
        open={!!closeTarget}
        onOpenChange={(open) => {
          if (!open) setCloseTarget(null)
        }}
        onConfirm={handleCloseTrade}
        isLoading={isActionsLoading}
        currency={currency}
      />
    </>
  )
}
