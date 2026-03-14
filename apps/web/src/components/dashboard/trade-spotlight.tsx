"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { usePositionsDashboard, type ProximityTrade } from "./use-positions-dashboard"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { useTradeActions } from "@/hooks/use-trade-actions"
import { TradeSpotlightCard } from "./trade-spotlight-card"
import { TradeDetailDrawer, type TradeUnion } from "@/components/positions/trade-detail-drawer"
import { CloseTradeDialog } from "@/components/positions/close-trade-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Crosshair, Clock, Search } from "lucide-react"
import type { OpenTradeData } from "@fxflow/types"

const MAX_SPOTLIGHT = 3

export function TradeSpotlight() {
  const {
    isLoaded,
    isConfigured,
    hasError,
    openWithPrices,
    tradesNearClosing,
    summary,
    currency,
    pricesByInstrument,
  } = usePositionsDashboard()
  const { tradeFinderScanStatus, lastAiTraderScanStatus } = useDaemonStatus()
  const { closeTrade, isLoading: isClosing } = useTradeActions()

  const [drawerTrade, setDrawerTrade] = useState<TradeUnion | null>(null)
  const [closeTarget, setCloseTarget] = useState<OpenTradeData | null>(null)

  // Build proximity map for fast lookup
  const proximityMap = useMemo(() => {
    const map = new Map<string, ProximityTrade>()
    for (const p of tradesNearClosing) map.set(p.trade.id, p)
    return map
  }, [tradesNearClosing])

  // Sort trades by urgency: proximity first, then by absolute P&L
  const spotlightTrades = useMemo(() => {
    const trades = [...openWithPrices]
    trades.sort((a, b) => {
      const aPx = proximityMap.get(a.id)
      const bPx = proximityMap.get(b.id)
      // Proximity trades first
      if (aPx && !bPx) return -1
      if (!aPx && bPx) return 1
      if (aPx && bPx) return bPx.proximityPercent - aPx.proximityPercent
      // Then by absolute unrealized P&L
      return Math.abs(b.unrealizedPL) - Math.abs(a.unrealizedPL)
    })
    return trades.slice(0, MAX_SPOTLIGHT)
  }, [openWithPrices, proximityMap])

  const handleClose = useCallback(
    async (trade: OpenTradeData) => {
      await closeTrade(trade.sourceTradeId)
    },
    [closeTrade],
  )

  // Not configured
  if (!isConfigured) return null

  // Loading
  if (!isLoaded) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Skeleton className="size-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  // No trades — contextual empty state
  if (openWithPrices.length === 0) {
    const isScanning = tradeFinderScanStatus?.isScanning || lastAiTraderScanStatus?.scanning

    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
        {isScanning ? (
          <>
            <Search className="text-muted-foreground size-8 animate-pulse" />
            <p className="text-sm font-medium">Scanning for opportunities…</p>
            <p className="text-muted-foreground text-xs">
              {summary.pendingCount > 0
                ? `${summary.pendingCount} order${summary.pendingCount !== 1 ? "s" : ""} waiting to fill`
                : "Your scanners are looking for trade setups"}
            </p>
          </>
        ) : (
          <>
            <Crosshair className="text-muted-foreground size-8" />
            <p className="text-sm font-medium">No active trades</p>
            <p className="text-muted-foreground text-xs">
              {summary.pendingCount > 0 ? (
                <>
                  <Clock className="mb-0.5 inline size-3" /> {summary.pendingCount} pending order
                  {summary.pendingCount !== 1 ? "s" : ""} waiting to fill
                </>
              ) : (
                "Open a trade or enable automation to get started"
              )}
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Section label */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
          <Crosshair className="size-3.5" />
          Live Trades
        </h2>
        <Link
          href="/positions"
          className="text-muted-foreground hover:text-foreground text-xs transition-colors"
        >
          View all →
        </Link>
      </div>

      {/* Spotlight cards */}
      <div className="space-y-2">
        {spotlightTrades.map((trade, i) => {
          const px = proximityMap.get(trade.id)
          const proximityLabel = px
            ? px.proximityType === "tp"
              ? `${Math.round(px.proximityPercent)}% to TP`
              : `${Math.round(px.proximityPercent)}% to SL`
            : null

          return (
            <div
              key={trade.id}
              style={{ animationDelay: `${i * 75}ms` }}
              className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both"
            >
              <TradeSpotlightCard
                trade={trade}
                progressPercent={px?.progressPercent ?? null}
                proximityLabel={proximityLabel}
                currency={currency}
                onClose={() => setCloseTarget(trade)}
                onSelect={() => setDrawerTrade({ ...trade, _type: "open" as const })}
              />
            </div>
          )
        })}
      </div>

      {/* Pending count */}
      {summary.pendingCount > 0 && (
        <Link
          href="/positions?tab=pending"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-1 text-xs transition-colors"
        >
          <Clock className="size-3" />
          {summary.pendingCount} pending order{summary.pendingCount !== 1 ? "s" : ""}
        </Link>
      )}

      {/* Trade detail drawer */}
      <TradeDetailDrawer
        trade={drawerTrade}
        open={drawerTrade !== null}
        onOpenChange={(open) => !open && setDrawerTrade(null)}
        currency={currency}
        currentPrice={
          drawerTrade?._type === "open" ? (drawerTrade.currentPrice ?? undefined) : undefined
        }
        lastTick={
          drawerTrade
            ? (() => {
                const tick = pricesByInstrument.get(drawerTrade.instrument)
                if (!tick) return undefined
                return {
                  ...tick,
                  instrument: drawerTrade.instrument,
                  time: new Date().toISOString(),
                }
              })()
            : undefined
        }
        onCloseTrade={() => {
          if (drawerTrade?._type === "open") {
            void closeTrade(drawerTrade.sourceTradeId)
          }
        }}
      />

      {/* Close trade confirmation */}
      {closeTarget && (
        <CloseTradeDialog
          trade={closeTarget}
          open={closeTarget !== null}
          onOpenChange={(open) => !open && setCloseTarget(null)}
          onConfirm={(units) => handleClose(closeTarget)}
          isLoading={isClosing}
          currency={currency}
        />
      )}
    </div>
  )
}
