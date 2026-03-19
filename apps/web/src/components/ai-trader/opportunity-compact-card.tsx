"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { AiTraderOpportunityData } from "@fxflow/types"
import { ConfidenceBar } from "./confidence-bar"
import { ScoreBreakdown } from "./score-breakdown"
import { OpportunityDecisionDetail } from "./opportunity-decision-detail"

interface Props {
  opportunity: AiTraderOpportunityData
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  detected: { label: "Detected", className: "border-blue-500/30 text-blue-600" },
  suggested: { label: "Suggested", className: "border-amber-500/30 text-amber-600" },
  approved: { label: "Approved", className: "border-emerald-500/30 text-emerald-600" },
  placed: { label: "Placed", className: "border-purple-500/30 text-purple-600" },
  filled: { label: "Filled", className: "border-teal-500/30 text-teal-600" },
  managed: { label: "Managing", className: "border-blue-500/30 text-blue-600" },
  closed: { label: "Closed", className: "border-border text-muted-foreground" },
  rejected: { label: "Rejected", className: "border-red-500/30 text-red-500" },
  expired: { label: "Expired", className: "border-border text-muted-foreground" },
  skipped: { label: "Skipped", className: "border-border text-muted-foreground" },
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function OpportunityCompactCard({ opportunity: opp }: Props) {
  const [expanded, setExpanded] = useState(false)

  const pair = opp.instrument.replace("_", "/")
  const isLong = opp.direction === "long"
  const badge = STATUS_BADGE[opp.status] ?? { label: opp.status, className: "" }
  const hasPL = opp.realizedPL != null && opp.status === "closed"

  return (
    <div className="bg-card rounded-lg border">
      {/* Compact header row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-3 text-left"
        aria-expanded={expanded}
      >
        {/* Instrument + direction */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{pair}</span>
            <span
              className={cn(
                "text-[10px] font-semibold uppercase",
                isLong ? "text-emerald-600" : "text-red-500",
              )}
            >
              {isLong ? "BUY" : "SELL"}
            </span>
            <span className="text-muted-foreground text-[10px]">{opp.profile}</span>
          </div>
        </div>

        {/* Confidence */}
        <span
          className={cn(
            "shrink-0 font-mono text-xs font-semibold tabular-nums",
            opp.confidence >= 80
              ? "text-emerald-600"
              : opp.confidence >= 60
                ? "text-amber-600"
                : "text-red-500",
          )}
        >
          {opp.confidence}%
        </span>

        {/* P&L */}
        {hasPL && (
          <span
            className={cn(
              "shrink-0 font-mono text-xs tabular-nums",
              opp.realizedPL! >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400",
            )}
          >
            {opp.realizedPL! >= 0 ? "+" : ""}${opp.realizedPL!.toFixed(2)}
          </span>
        )}

        {/* Status badge */}
        <Badge variant="outline" className={cn("shrink-0 text-[10px]", badge.className)}>
          {badge.label}
        </Badge>

        {/* Time */}
        <span className="text-muted-foreground hidden shrink-0 text-[10px] sm:inline">
          {timeAgo(opp.detectedAt)}
        </span>

        {expanded ? (
          <ChevronUp className="text-muted-foreground size-3.5 shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground size-3.5 shrink-0" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="space-y-3 border-t px-3 pb-3 pt-2">
          <ConfidenceBar confidence={opp.confidence} />

          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-muted-foreground text-[10px]">Entry</p>
              <p className="font-mono text-xs tabular-nums">
                {opp.entryPrice.toFixed(opp.instrument.includes("JPY") ? 3 : 5)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px]">Stop</p>
              <p className="font-mono text-xs tabular-nums text-red-500">
                {opp.stopLoss.toFixed(opp.instrument.includes("JPY") ? 3 : 5)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px]">Target</p>
              <p className="font-mono text-xs tabular-nums text-emerald-600">
                {opp.takeProfit.toFixed(opp.instrument.includes("JPY") ? 3 : 5)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px]">R:R</p>
              <p className="text-xs font-medium tabular-nums">1:{opp.riskRewardRatio.toFixed(1)}</p>
            </div>
          </div>

          {opp.scores && <ScoreBreakdown scores={opp.scores} />}

          <OpportunityDecisionDetail opportunity={opp} />
        </div>
      )}
    </div>
  )
}
