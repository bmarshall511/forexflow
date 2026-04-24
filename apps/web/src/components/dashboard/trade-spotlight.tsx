"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { Crosshair, Clock, Search } from "lucide-react"
import type { OpenTradeData } from "@fxflow/types"
import { usePositionsDashboard, type ProximityTrade } from "./use-positions-dashboard"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { useTradeActions } from "@/hooks/use-trade-actions"
import { TradeSpotlightCard } from "./trade-spotlight-card"
import { TradeDetailDrawer, type TradeUnion } from "@/components/positions/trade-detail-drawer"
import { CloseTradeDialog } from "@/components/positions/close-trade-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionCard } from "@/components/dashboard/shared"

/**
 * Live trades rail — the two or three open trades the user most needs to
 * watch right now. Sorted by proximity to SL/TP first, then by absolute
 * unrealized P&L so the loudest position sits on top. Each card deep-links
 * to the shared TradeDetailDrawer and exposes a one-tap close flow.
 *
 * Wrapped in the dashboard's shared SectionCard so it visually matches
 * Depth Sections, Activity Feed, and the performance hero without its
 * own bespoke chrome.
 */
const MAX_SPOTLIGHT = 3

export function TradeSpotlight() {
  const {
    isLoaded,
    isConfigured,
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

  const proximityMap = useMemo(() => {
    const map = new Map<string, ProximityTrade>()
    for (const p of tradesNearClosing) map.set(p.trade.id, p)
    return map
  }, [tradesNearClosing])

  const spotlightTrades = useMemo(() => {
    const trades = [...openWithPrices]
    trades.sort((a, b) => {
      const aPx = proximityMap.get(a.id)
      const bPx = proximityMap.get(b.id)
      if (aPx && !bPx) return -1
      if (!aPx && bPx) return 1
      if (aPx && bPx) return bPx.proximityPercent - aPx.proximityPercent
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

  if (!isConfigured) return null

  const action = (
    <Link
      href="/positions"
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring text-[11px] transition-colors focus-visible:rounded focus-visible:outline-none focus-visible:ring-2"
    >
      View all →
    </Link>
  )

  return (
    <SectionCard
      icon={<Crosshair className="size-4" />}
      title="Live trades"
      meta={
        isLoaded && openWithPrices.length > 0
          ? `${openWithPrices.length} open${summary.pendingCount > 0 ? ` · ${summary.pendingCount} pending` : ""}`
          : undefined
      }
      action={action}
    >
      {!isLoaded ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : openWithPrices.length === 0 ? (
        <EmptyState
          isScanning={Boolean(
            tradeFinderScanStatus?.isScanning || lastAiTraderScanStatus?.scanning,
          )}
          pendingCount={summary.pendingCount}
        />
      ) : (
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
          {openWithPrices.length > MAX_SPOTLIGHT && (
            <Link
              href="/positions"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring block rounded px-1 py-1 text-center text-[11px] focus-visible:outline-none focus-visible:ring-2"
            >
              +{openWithPrices.length - MAX_SPOTLIGHT} more open trade
              {openWithPrices.length - MAX_SPOTLIGHT !== 1 ? "s" : ""}
            </Link>
          )}
        </div>
      )}

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

      {closeTarget && (
        <CloseTradeDialog
          trade={closeTarget}
          open={closeTarget !== null}
          onOpenChange={(open) => !open && setCloseTarget(null)}
          onConfirm={() => handleClose(closeTarget)}
          isLoading={isClosing}
          currency={currency}
        />
      )}
    </SectionCard>
  )
}

function EmptyState({ isScanning, pendingCount }: { isScanning: boolean; pendingCount: number }) {
  if (isScanning) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-6 text-center">
        <Search
          className="text-muted-foreground size-7 motion-safe:animate-pulse"
          aria-hidden="true"
        />
        <p className="text-sm font-medium">Scanning for opportunities…</p>
        <p className="text-muted-foreground text-xs">
          {pendingCount > 0
            ? `${pendingCount} order${pendingCount !== 1 ? "s" : ""} waiting to fill`
            : "Your scanners are looking for trade setups"}
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-1.5 py-6 text-center">
      <Crosshair className="text-muted-foreground size-7" aria-hidden="true" />
      <p className="text-sm font-medium">No active trades</p>
      <p className="text-muted-foreground text-xs">
        {pendingCount > 0 ? (
          <>
            <Clock className="mb-0.5 inline size-3" /> {pendingCount} pending order
            {pendingCount !== 1 ? "s" : ""} waiting to fill
          </>
        ) : (
          "Open a trade or enable automation to get started"
        )}
      </p>
    </div>
  )
}
