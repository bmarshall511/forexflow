"use client"

import type { ConfluenceBreakdown } from "@fxflow/types"
import { cn } from "@/lib/utils"

/** Small inline badge showing the confluence score (0-10) with color coding. */
export function ConfluenceScoreBadge({ score, className }: { score: number; className?: string }) {
  const color =
    score >= 7
      ? "bg-green-500/15 text-green-600 dark:text-green-400"
      : score >= 5
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : "bg-red-500/15 text-red-600 dark:text-red-400"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
        color,
        className,
      )}
      title={`Confluence score: ${score.toFixed(1)}/10`}
    >
      {score.toFixed(1)}
    </span>
  )
}

/** Expanded breakdown showing each factor's score and status. */
export function ConfluenceBreakdownView({
  breakdown,
  className,
}: {
  breakdown: ConfluenceBreakdown
  className?: string
}) {
  const factors = [
    { key: "trend", label: "Trend (EMA)", ...breakdown.trend },
    { key: "momentum", label: "Momentum (RSI)", ...breakdown.momentum },
    { key: "volatility", label: "Volatility (ADX)", ...breakdown.volatility },
    { key: "htfTrend", label: "Higher TF", ...breakdown.htfTrend },
    { key: "session", label: "Session", ...breakdown.session },
  ]

  return (
    <div className={cn("space-y-1.5", className)}>
      {factors.map((f) => {
        if (!f.enabled) return null
        const pct = f.weight > 0 ? `${f.weight}%` : ""
        const barWidth = `${(f.score / 10) * 100}%`
        const barColor =
          f.score >= 7 ? "bg-green-500" : f.score >= 5 ? "bg-amber-500" : "bg-red-500"

        return (
          <div key={f.key} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {f.label}
                {pct && <span className="ml-1 opacity-60">({pct})</span>}
              </span>
              <span className="font-mono font-medium">{f.score.toFixed(1)}</span>
            </div>
            <div className="bg-muted h-1 overflow-hidden rounded-full">
              <div
                className={cn("h-full rounded-full transition-all", barColor)}
                style={{ width: barWidth }}
              />
            </div>
            <FactorDetail detail={f.detail} factorKey={f.key} />
          </div>
        )
      })}
    </div>
  )
}

function FactorDetail({ detail, factorKey }: { detail: unknown; factorKey: string }) {
  if (!detail || typeof detail !== "object") return null
  const d = detail as Record<string, unknown>

  let text = ""
  switch (factorKey) {
    case "trend":
      text = `${d.alignment ?? ""}`
      break
    case "momentum":
      text = `RSI ${typeof d.rsi === "number" ? (d.rsi as number).toFixed(0) : "?"} — ${d.zone ?? ""}`
      break
    case "volatility":
      text = `ADX ${typeof d.adx === "number" ? (d.adx as number).toFixed(0) : "?"} — ${d.regime ?? ""}`
      break
    case "htfTrend":
      text = `${d.timeframe ?? ""} — ${d.alignment ?? ""}`
      break
    case "session":
      text = `${d.session ?? ""}${d.isKillZone ? " (kill zone)" : ""}`
      break
  }

  if (!text) return null
  return <p className="text-muted-foreground text-[10px] leading-tight">{text}</p>
}
