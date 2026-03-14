"use client"

import { Shield, X, Wrench, Eye, AlertTriangle, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface TldrCardProps {
  tldr: {
    action: string
    sentence: string
    urgency: string
  }
  winProbability?: number
  qualityScore?: number
}

export function TldrCard({ tldr, winProbability, qualityScore }: TldrCardProps) {
  const isPositive =
    (tldr.action === "hold" || tldr.action === "watch") && (winProbability ?? 50) >= 60
  const isDanger =
    tldr.action === "close" || tldr.action === "exit_now" || (winProbability ?? 50) < 40
  const isWarning = !isPositive && !isDanger
  // isWarning kept for clarity — borderColor/bgColor fall through to amber when neither positive nor danger
  void isWarning

  const borderColor = isPositive
    ? "border-emerald-500/50"
    : isDanger
      ? "border-red-500/50"
      : "border-amber-500/50"
  const bgColor = isPositive ? "bg-emerald-500/5" : isDanger ? "bg-red-500/5" : "bg-amber-500/5"

  const actionIcons: Record<string, React.ElementType> = {
    hold: Shield,
    close: X,
    exit_now: AlertTriangle,
    adjust: Wrench,
    reduce: TrendingDown,
    watch: Eye,
  }
  const Icon = actionIcons[tldr.action] ?? Eye

  const urgencyLabel =
    tldr.urgency === "now" ? "Act Now" : tldr.urgency === "soon" ? "Soon" : "Monitor"
  const urgencyColor =
    tldr.urgency === "now"
      ? "bg-red-500 text-white animate-pulse"
      : tldr.urgency === "soon"
        ? "bg-amber-500 text-white"
        : "bg-muted text-muted-foreground"

  return (
    <div className={cn("rounded-lg border-2 p-4", borderColor, bgColor)}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "rounded-full p-2",
            isPositive
              ? "bg-emerald-500/10 text-emerald-500"
              : isDanger
                ? "bg-red-500/10 text-red-500"
                : "bg-amber-500/10 text-amber-500",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold uppercase tracking-wide">
              {tldr.action.replace("_", " ")}
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", urgencyColor)}>
              {urgencyLabel}
            </span>
          </div>
          <p className="text-sm leading-relaxed">{tldr.sentence}</p>
          {(winProbability != null || qualityScore != null) && (
            <div className="text-muted-foreground mt-2 flex flex-wrap gap-4 text-xs">
              {winProbability != null && (
                <div className="flex items-center gap-1.5">
                  <span>Win Probability:</span>
                  <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full bg-current"
                      style={{ width: `${Math.round(winProbability)}%` }}
                    />
                  </div>
                  <span className="font-medium">{Math.round(winProbability)}%</span>
                </div>
              )}
              {qualityScore != null && (
                <div className="flex items-center gap-1.5">
                  <span>Quality:</span>
                  <span className="font-medium">{qualityScore}/100</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
