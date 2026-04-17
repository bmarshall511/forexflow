"use client"

import type { TradeFinderSetupData } from "@fxflow/types"
import { useLivePrice } from "@/hooks/use-live-price"
import { getPipSize, formatPips } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { TF_MGMT_ACTION_LABELS } from "@/lib/trade-finder-display"
import { ManagementTimeline } from "./management-timeline"
import { TheoreticalOutcomeBadge } from "./theoretical-outcome-badge"
import { Bot, Shield, TrendingUp, TrendingDown } from "lucide-react"

interface LiveTradesTabProps {
  setups: TradeFinderSetupData[]
}

export function LiveTradesTab({ setups }: LiveTradesTabProps) {
  const filledSetups = setups.filter((s) => s.status === "filled")

  if (filledSetups.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center text-sm">
        <p>No active Trade Finder trades.</p>
        <p className="mt-1 text-xs">
          Trades placed by the scanner will appear here while they are open.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {filledSetups.map((setup) => (
        <LiveTradeCard key={setup.id} setup={setup} />
      ))}
    </div>
  )
}

function LiveTradeCard({ setup }: { setup: TradeFinderSetupData }) {
  const { bid } = useLivePrice(setup.instrument)
  const pipSize = getPipSize(setup.instrument)
  const currentPrice = bid ?? setup.entryPrice

  const pnlPips =
    setup.direction === "long"
      ? (currentPrice - setup.entryPrice) / pipSize
      : (setup.entryPrice - currentPrice) / pipSize

  const isProfit = pnlPips >= 0
  const isAiManaged = setup.managementLog.some((l) => l.action === "ai_handoff")

  return (
    <div className="bg-card rounded-lg border p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {setup.direction === "long" ? (
            <TrendingUp className="size-4 text-green-500" />
          ) : (
            <TrendingDown className="size-4 text-red-500" />
          )}
          <span className="font-mono text-sm font-semibold">
            {setup.instrument.replace("_", "/")}
          </span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
              setup.direction === "long"
                ? "bg-green-500/10 text-green-500"
                : "bg-red-500/10 text-red-500",
            )}
          >
            {setup.direction}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Management status badges */}
          {isAiManaged && (
            <span className="flex items-center gap-1 rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-400">
              <Bot className="size-3" />
              AI Managing
            </span>
          )}
          {setup.breakevenMoved && (
            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-400">
              <Shield className="mr-0.5 inline size-3" />
              BE
            </span>
          )}
          {setup.partialTaken && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">
              Partial
            </span>
          )}
          <TheoreticalOutcomeBadge outcome={setup.theoreticalOutcome} />
        </div>
      </div>

      {/* P&L display */}
      <div className="mt-3 flex items-baseline gap-3">
        <span
          className={cn(
            "font-mono text-lg font-bold tabular-nums",
            isProfit ? "text-green-500" : "text-red-500",
          )}
        >
          {isProfit ? "+" : ""}
          {formatPips(pnlPips)} pips
        </span>
        <span className="text-muted-foreground text-xs">
          Score: {setup.scores.total}/{setup.scores.maxPossible}
        </span>
      </div>

      {/* Price levels */}
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Entry</span>
          <p className="font-mono tabular-nums">{setup.entryPrice.toFixed(5)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">SL</span>
          <p className="font-mono tabular-nums text-red-400">{setup.stopLoss.toFixed(5)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">TP</span>
          <p className="font-mono tabular-nums text-green-400">{setup.takeProfit.toFixed(5)}</p>
        </div>
      </div>

      {/* Management timeline */}
      {setup.managementLog.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <ManagementTimeline actions={setup.managementLog} />
        </div>
      )}
    </div>
  )
}
