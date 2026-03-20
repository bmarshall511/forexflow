"use client"

import { useState } from "react"
import type { TradeFinderSetupData } from "@fxflow/types"
import { formatInstrument, getPipSize } from "@fxflow/shared"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, Zap, AlertCircle } from "lucide-react"
import { usePositions } from "@/hooks/use-positions"
import { cn } from "@/lib/utils"
import { SetupCardDetails } from "./setup-card-details"
import { SetupCardActions } from "./setup-card-actions"

// ─── Exported types & constants ───

export interface AutoTradeConfig {
  autoTradeEnabled: boolean
  autoTradeMinScore: number
  autoTradeMinRR: number
}

interface SetupCardProps {
  setup: TradeFinderSetupData
  onPlace?: (setupId: string, orderType: "MARKET" | "LIMIT") => void
  autoTradeConfig?: AutoTradeConfig
}

export const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  active: { className: "bg-blue-500/10 text-blue-500 border-blue-500/20", label: "Watching" },
  approaching: {
    className: "bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse",
    label: "Approaching",
  },
  placed: { className: "bg-teal-500/10 text-teal-500 border-teal-500/20", label: "Pending" },
  filled: { className: "bg-green-500/10 text-green-500 border-green-500/20", label: "Filled" },
  invalidated: { className: "bg-red-500/10 text-red-500 border-red-500/20", label: "Invalidated" },
  expired: { className: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20", label: "Expired" },
}

export const TF_LABELS: Record<string, string> = {
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
}

export function fmtDollar(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`
  return `$${amount.toFixed(2)}`
}

export function computeDollarAmount(
  positionSize: number,
  pips: number,
  instrument: string,
): number {
  const pipSize = getPipSize(instrument)
  return positionSize * pips * pipSize
}

// ─── Auto-trade status logic ───

export type AutoTradeStatus =
  | { type: "eligible" }
  | { type: "queued"; position: number | null; reason: string }
  | { type: "blocked"; reason: string }
  | null

const CAP_KEYWORDS = ["concurrent", "risk"]

function isCappedReason(reason: string): boolean {
  const lower = reason.toLowerCase()
  return CAP_KEYWORDS.some((kw) => lower.includes(kw))
}

function getAutoTradeStatus(
  setup: TradeFinderSetupData,
  config: AutoTradeConfig,
): AutoTradeStatus {
  if (!config.autoTradeEnabled) return null
  if (setup.status === "placed" || setup.status === "filled") return null
  if (setup.autoPlaced) return null
  if (setup.status !== "active" && setup.status !== "approaching") return null

  if (setup.scores.total < config.autoTradeMinScore) {
    return {
      type: "blocked",
      reason: `Quality too low — scored ${setup.scores.total}, needs at least ${config.autoTradeMinScore}`,
    }
  }

  const rrNum = parseFloat(setup.rrRatio)
  if (!isNaN(rrNum) && rrNum < config.autoTradeMinRR) {
    return { type: "blocked", reason: `Profit target too small — needs at least ${config.autoTradeMinRR}:1` }
  }

  if (setup.lastSkipReason) {
    if (isCappedReason(setup.lastSkipReason)) {
      return { type: "queued", position: setup.queuePosition, reason: setup.lastSkipReason }
    }
    return { type: "blocked", reason: setup.lastSkipReason }
  }

  if (setup.queuePosition != null) {
    return { type: "queued", position: setup.queuePosition, reason: "In line — waiting for a trade slot to open up" }
  }

  return { type: "eligible" }
}

// ─── Component ───

export function SetupCard({ setup, onPlace, autoTradeConfig }: SetupCardProps) {
  const [open, setOpen] = useState(false)
  const [showChart, setShowChart] = useState(false)

  const isLong = setup.direction === "long"
  const scorePct = Math.round((setup.scores.total / setup.scores.maxPossible) * 100)
  const scoreColor =
    scorePct >= 75 ? "text-green-500" : scorePct >= 58 ? "text-amber-500" : "text-orange-500"
  const scoreBg =
    scorePct >= 75 ? "bg-green-500/10" : scorePct >= 58 ? "bg-amber-500/10" : "bg-orange-500/10"

  const { pricesByInstrument } = usePositions()
  const lastTick = pricesByInstrument.get(setup.instrument) ?? null

  const riskDollars = computeDollarAmount(setup.positionSize, setup.riskPips, setup.instrument)
  const rewardDollars = computeDollarAmount(setup.positionSize, setup.rewardPips, setup.instrument)

  const autoTradeStatus = autoTradeConfig ? getAutoTradeStatus(setup, autoTradeConfig) : null

  // Collapsed status badge: combine auto-placed states into one badge
  const statusBadge = (() => {
    if (setup.autoPlaced && (setup.status === "placed" || setup.status === "filled")) {
      const isFilled = setup.status === "filled"
      return (
        <Badge
          variant="outline"
          className={cn(
            "gap-0.5 px-1.5 py-0 text-[10px]",
            isFilled
              ? "border-green-500/20 bg-green-500/10 text-green-500"
              : "border-teal-500/20 bg-teal-500/10 text-teal-500",
          )}
        >
          <Zap className="size-2.5" />
          {isFilled ? "Auto Filled" : "Auto Pending"}
        </Badge>
      )
    }

    const statusInfo = STATUS_STYLES[setup.status] ?? { className: "", label: setup.status }
    return (
      <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", statusInfo.className)}>
        {statusInfo.label}
      </Badge>
    )
  })()

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "border-border/60 bg-card overflow-hidden rounded-xl border border-l-[3px]",
          setup.autoPlaced && setup.status === "placed"
            ? "border-l-teal-500"
            : setup.autoPlaced && setup.status === "filled"
              ? "border-l-green-500"
              : isLong
                ? "border-l-green-500"
                : "border-l-red-500",
        )}
      >
        {/* ─── Collapsed Header ─── */}
        <CollapsibleTrigger asChild>
          <button className="hover:bg-muted/30 flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors">
            {/* Main info */}
            <div className="min-w-0 flex-1">
              {/* Row 1: Instrument + Direction + Status (max 3 badges) */}
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight">
                  {formatInstrument(setup.instrument)}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-0 px-1.5 py-0 text-[10px] font-semibold",
                    isLong ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500",
                  )}
                >
                  {isLong ? "BUY" : "SELL"}
                </Badge>
                {statusBadge}
              </div>

              {/* Row 2: R:R / Risk / Reward / Distance */}
              <div className="mt-1 flex items-center gap-3 text-[11px]">
                <span className="text-muted-foreground">R:R {setup.rrRatio}</span>
                <span className="text-muted-foreground">
                  Risk{" "}
                  <span className="font-medium text-red-500">{fmtDollar(riskDollars)}</span>
                  {" "}→ Reward{" "}
                  <span className="font-medium text-green-500">{fmtDollar(rewardDollars)}</span>
                </span>
                <span className="text-muted-foreground">
                  {setup.distanceToEntryPips.toFixed(0)}p away
                </span>
              </div>

              {/* Skip reason as subtle line below row 2 */}
              {(autoTradeStatus?.type === "queued" || autoTradeStatus?.type === "blocked") && (
                <div className="mt-0.5 flex items-center gap-1">
                  <AlertCircle className="size-3 shrink-0 text-amber-500/70" />
                  <span className="truncate text-[10px] text-amber-500/70">
                    {autoTradeStatus.reason}
                  </span>
                </div>
              )}
            </div>

            {/* Score circle (size-11) */}
            <div
              className={cn(
                "flex size-11 shrink-0 flex-col items-center justify-center rounded-full",
                scoreBg,
              )}
            >
              <span
                className={cn(
                  "font-mono text-sm font-bold tabular-nums leading-none",
                  scoreColor,
                )}
              >
                {setup.scores.total}
              </span>
              <span className="text-muted-foreground mt-0.5 text-[8px] leading-none">
                /{setup.scores.maxPossible}
              </span>
            </div>

            <ChevronDown
              className={cn(
                "text-muted-foreground size-4 shrink-0 transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>

        {/* ─── Expanded Content ─── */}
        <CollapsibleContent>
          <SetupCardDetails
            setup={setup}
            showChart={showChart}
            onToggleChart={() => setShowChart(!showChart)}
            lastTick={lastTick}
            autoTradeStatus={autoTradeStatus}
          />
          <SetupCardActions setup={setup} onPlace={onPlace} />
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
