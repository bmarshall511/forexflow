"use client"

/**
 * Body content for the SmartFlow Trade Review drawer. Composes the header,
 * three headline tiles, entry-context table, management timeline, and the
 * optional config card. Separated from the Sheet wrapper so each file
 * stays within the project's ≤150-LOC component rule.
 */

import type { SmartFlowTradeData } from "@fxflow/types"
import { formatInstrument } from "@fxflow/shared"
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DirectionBadge } from "@/components/positions/direction-badge"
import { Badge } from "@/components/ui/badge"
import { ShieldAlert, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { TradeReviewTimeline } from "./trade-review-timeline"
import { ContextRow, SectionHeader, Tile } from "./trade-review-parts"
import {
  PRESET_LABELS,
  REGIME_LABELS,
  SAFETY_NET_LABELS,
  buildTimeline,
  formatCloseReason,
  formatDurationMs,
  formatMoney,
  formatPips,
  formatPrice,
} from "./trade-review-utils"

export function TradeReviewBody({ trade }: { trade: SmartFlowTradeData }) {
  const instrument = trade.instrument ? formatInstrument(trade.instrument) : "Unknown"
  const direction = trade.direction ?? "long"
  const preset = PRESET_LABELS[trade.preset ?? ""] ?? trade.preset ?? "Custom"
  const wasSafetyNet = trade.safetyNetTriggered != null
  const outcomeLabel = wasSafetyNet
    ? (SAFETY_NET_LABELS[trade.safetyNetTriggered ?? ""] ?? "Safety exit")
    : "Target reached"
  const outcomeColor = wasSafetyNet ? "text-amber-500" : "text-emerald-500"
  const OutcomeIcon = wasSafetyNet ? ShieldAlert : Target

  const durationMs =
    trade.closedAt && trade.createdAt
      ? new Date(trade.closedAt).getTime() - new Date(trade.createdAt).getTime()
      : 0
  const duration = formatDurationMs(durationMs)

  const plMoney = formatMoney(trade.realizedPL)
  const plPips = formatPips(trade.realizedPips)
  const plColor =
    trade.realizedPL == null
      ? "text-muted-foreground"
      : trade.realizedPL > 0
        ? "text-emerald-500"
        : trade.realizedPL < 0
          ? "text-red-500"
          : "text-muted-foreground"

  const timeline = buildTimeline(trade)
  const regimeLabel = trade.regimeAtPlacement
    ? (REGIME_LABELS[trade.regimeAtPlacement] ?? trade.regimeAtPlacement)
    : null

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              wasSafetyNet ? "bg-amber-500/10" : "bg-emerald-500/10",
            )}
          >
            <OutcomeIcon className={cn("size-4", outcomeColor)} />
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="flex items-center gap-2 text-base">
              {instrument}
              <DirectionBadge direction={direction as "long" | "short"} />
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                {preset}
              </Badge>
            </SheetTitle>
            <SheetDescription className={cn("text-xs", outcomeColor)}>
              {outcomeLabel}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="grid grid-cols-3 gap-2 px-4 py-3">
        <Tile label="Realised P&L" value={plMoney} sub={plPips} valueColor={plColor} />
        <Tile
          label="Duration"
          value={duration}
          sub={
            trade.closedAt
              ? new Date(trade.closedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : undefined
          }
        />
        <Tile label="Actions" value={String(timeline.length)} sub="logged" />
      </div>

      <section className="px-4 pb-3">
        <SectionHeader>Entry context</SectionHeader>
        <div className="divide-border bg-muted/20 divide-y rounded-md border text-xs">
          <ContextRow label="Entry price" value={formatPrice(trade.entryPrice, trade.instrument)} />
          <ContextRow label="Exit price" value={formatPrice(trade.exitPrice, trade.instrument)} />
          <ContextRow
            label="ATR at placement"
            value={formatPrice(trade.atrAtPlacement, trade.instrument)}
          />
          <ContextRow label="Regime at placement" value={regimeLabel ?? "—"} />
          <ContextRow
            label="Entry spread"
            value={trade.entrySpread != null ? `${trade.entrySpread.toFixed(1)} pips` : "—"}
          />
          <ContextRow
            label="Avg spread (tracked)"
            value={trade.avgSpread != null ? `${trade.avgSpread.toFixed(1)} pips` : "—"}
          />
          <ContextRow
            label="Financing accrued"
            value={`$${trade.financingAccumulated.toFixed(2)}`}
          />
          <ContextRow label="Close reason" value={formatCloseReason(trade.closeReason)} />
        </div>
      </section>

      <section className="px-4 pb-4">
        <SectionHeader>Management timeline</SectionHeader>
        <TradeReviewTimeline events={timeline} />
      </section>

      {trade.configName && (
        <section className="px-4 pb-4">
          <SectionHeader>Config</SectionHeader>
          <div className="bg-muted/20 rounded-md border px-3 py-2 text-xs">
            <span className="text-muted-foreground">Plan:</span>{" "}
            <span className="font-medium">{trade.configName}</span>
          </div>
        </section>
      )}
    </>
  )
}
