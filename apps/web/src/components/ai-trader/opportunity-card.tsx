"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Check, X, ChevronDown, ChevronUp, Loader2, ExternalLink } from "lucide-react"
import type { AiTraderOpportunityData, AiTraderOperatingMode } from "@fxflow/types"
import { ConfidenceBar } from "./confidence-bar"
import { ScoreBreakdown } from "./score-breakdown"
import Link from "next/link"

interface OpportunityCardProps {
  opportunity: AiTraderOpportunityData
  operatingMode: AiTraderOperatingMode
  confidenceThreshold: number
  onAction: (id: string, action: "approve" | "reject") => Promise<void>
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  detected: { label: "Detected", className: "border-blue-500/30 text-blue-600" },
  suggested: {
    label: "Needs Review",
    className: "border-amber-500/30 text-amber-600 bg-amber-500/10",
  },
  approved: { label: "Approved", className: "border-emerald-500/30 text-emerald-600" },
  placed: { label: "Order Placed", className: "border-purple-500/30 text-purple-600" },
  filled: { label: "Trade Live", className: "border-teal-500/30 text-teal-600 bg-teal-500/10" },
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

function getStatusContext(
  opp: AiTraderOpportunityData,
  mode: AiTraderOperatingMode,
  threshold: number,
): string | null {
  if (opp.status === "suggested") {
    if (mode === "manual") {
      return "Your settings require manual approval for all trades. Approve to place a LIMIT order."
    }
    if (opp.confidence < threshold) {
      return `Confidence (${opp.confidence}%) is below your auto-execute threshold (${threshold}%). Review and approve if you agree with this trade.`
    }
    return "This trade is ready for your review. Approve to place a LIMIT order."
  }
  if (opp.status === "placed") {
    return `Order placed${opp.placedAt ? ` at ${new Date(opp.placedAt).toLocaleTimeString()}` : ""} — waiting for price to reach the entry level.`
  }
  if (opp.status === "filled") {
    return "Trade is live — the entry price was reached and the order filled."
  }
  if (opp.status === "rejected") {
    return "This opportunity was rejected — confidence was too low or a risk check failed."
  }
  if (opp.status === "skipped") {
    return "Skipped — a risk check prevented this trade (budget, max trades, or existing position)."
  }
  return null
}

export function OpportunityCard({
  opportunity: opp,
  operatingMode,
  confidenceThreshold,
  onAction,
}: OpportunityCardProps) {
  const [showScores, setShowScores] = useState(false)
  const [acting, setActing] = useState<"approve" | "reject" | null>(null)

  const pair = opp.instrument.replace("_", "/")
  const isLong = opp.direction === "long"
  const statusStyle = STATUS_STYLE[opp.status] ?? {
    label: opp.status,
    className: "border-border text-muted-foreground",
  }
  const context = getStatusContext(opp, operatingMode, confidenceThreshold)
  const isSuggested = opp.status === "suggested"
  const decimals = opp.instrument.includes("JPY") ? 3 : 5

  const handleAction = async (action: "approve" | "reject") => {
    setActing(action)
    try {
      await onAction(opp.id, action)
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="bg-background space-y-3 rounded-lg border p-4">
      {/* Header: headline + status + timestamp */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            Found a potential{" "}
            <span className={isLong ? "text-emerald-600" : "text-red-500"}>
              {isLong ? "BUY" : "SELL"}
            </span>{" "}
            on {pair}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[10px]">
            {opp.profile} &middot; {timeAgo(opp.detectedAt)}
          </p>
        </div>
        <Badge variant="outline" className={cn("shrink-0 text-[10px]", statusStyle.className)}>
          {statusStyle.label}
        </Badge>
      </div>

      {/* AI rationale */}
      {opp.entryRationale && (
        <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
          {opp.entryRationale}
        </p>
      )}

      {/* Confidence bar */}
      <div className="flex items-center gap-2">
        <ConfidenceBar confidence={opp.confidence} className="flex-1" />
        <span
          className={cn(
            "shrink-0 text-xs font-semibold tabular-nums",
            opp.confidence >= 80
              ? "text-emerald-600"
              : opp.confidence >= 60
                ? "text-amber-600"
                : "text-red-500",
          )}
        >
          {opp.confidence}%
        </span>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-muted-foreground text-[10px]">Entry</p>
          <p className="font-mono text-xs tabular-nums">{opp.entryPrice.toFixed(decimals)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px]">Stop Loss</p>
          <p className="font-mono text-xs tabular-nums text-red-500">
            {opp.stopLoss.toFixed(decimals)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px]">Target</p>
          <p className="font-mono text-xs tabular-nums text-emerald-600">
            {opp.takeProfit.toFixed(decimals)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px]">Risk:Reward</p>
          <p className="text-xs font-medium tabular-nums">1:{opp.riskRewardRatio.toFixed(1)}</p>
        </div>
      </div>

      {/* Status context */}
      {context && (
        <p className="bg-muted/50 rounded-md px-3 py-2 text-[11px] leading-relaxed">
          {context}
          {opp.status === "filled" && opp.resultTradeId && (
            <Link
              href={`/positions?trade=${opp.resultTradeId}`}
              className="text-primary ml-1 inline-flex items-center gap-0.5 underline"
            >
              View trade <ExternalLink className="size-2.5" />
            </Link>
          )}
        </p>
      )}

      {/* Score breakdown (collapsible) */}
      {opp.scores && (
        <div>
          <button
            type="button"
            onClick={() => setShowScores(!showScores)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[10px]"
          >
            {showScores ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            Score breakdown
          </button>
          {showScores && <ScoreBreakdown scores={opp.scores} className="mt-2" />}
        </div>
      )}

      {/* Action buttons */}
      {isSuggested && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="h-9 flex-1 text-xs"
            onClick={() => void handleAction("approve")}
            disabled={acting !== null}
          >
            {acting === "approve" ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <Check className="mr-1 size-3" />
            )}
            Approve Trade
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 flex-1 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-600"
            onClick={() => void handleAction("reject")}
            disabled={acting !== null}
          >
            {acting === "reject" ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <X className="mr-1 size-3" />
            )}
            Reject
          </Button>
        </div>
      )}
    </div>
  )
}
