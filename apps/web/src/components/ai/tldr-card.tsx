"use client"

import {
  Shield,
  X,
  Wrench,
  Eye,
  AlertTriangle,
  TrendingDown,
} from "lucide-react"
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
    (tldr.action === "hold" || tldr.action === "watch") &&
    (winProbability ?? 50) >= 60
  const isDanger =
    tldr.action === "close" ||
    tldr.action === "exit_now" ||
    (winProbability ?? 50) < 40
  const isWarning = !isPositive && !isDanger
  // isWarning kept for clarity — borderColor/bgColor fall through to amber when neither positive nor danger
  void isWarning

  const borderColor = isPositive
    ? "border-emerald-500/50"
    : isDanger
      ? "border-red-500/50"
      : "border-amber-500/50"
  const bgColor = isPositive
    ? "bg-emerald-500/5"
    : isDanger
      ? "bg-red-500/5"
      : "bg-amber-500/5"

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
    tldr.urgency === "now"
      ? "Act Now"
      : tldr.urgency === "soon"
        ? "Soon"
        : "Monitor"
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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm uppercase tracking-wide">
              {tldr.action.replace("_", " ")}
            </span>
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                urgencyColor,
              )}
            >
              {urgencyLabel}
            </span>
          </div>
          <p className="text-sm leading-relaxed">{tldr.sentence}</p>
          {(winProbability != null || qualityScore != null) && (
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
              {winProbability != null && (
                <div className="flex items-center gap-1.5">
                  <span>Win Probability:</span>
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-current"
                      style={{ width: `${Math.round(winProbability)}%` }}
                    />
                  </div>
                  <span className="font-medium">
                    {Math.round(winProbability)}%
                  </span>
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
