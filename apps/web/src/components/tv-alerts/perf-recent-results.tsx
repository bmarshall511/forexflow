"use client"

import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TVSignalRecentResult } from "@fxflow/types"

interface PerfRecentResultsProps {
  data: TVSignalRecentResult[]
}

function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const mins = Math.max(0, Math.floor(diffMs / 60_000))
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatInstrument(instrument: string): string {
  return instrument.replace("_", "/")
}

export function PerfRecentResults({ data }: PerfRecentResultsProps) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
        <Clock className="size-3" aria-hidden="true" />
        Recent Results
      </div>

      {data.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">No recent results yet</p>
      ) : (
        <ul className="space-y-1.5" aria-label="Recent trade results">
          {data.map((r) => {
            const isProfit = r.realizedPL > 0
            const isLoss = r.realizedPL < 0
            const isBuy = r.direction === "buy"

            return (
              <li key={r.signalId} className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    isProfit ? "bg-green-500" : isLoss ? "bg-red-500" : "bg-gray-400",
                  )}
                  aria-label={isProfit ? "Profit" : isLoss ? "Loss" : "Break even"}
                />

                <span className="font-medium">{formatInstrument(r.instrument)}</span>

                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-medium",
                    isBuy ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500",
                  )}
                >
                  {r.direction.toUpperCase()}
                </span>

                <span
                  className={cn(
                    "font-mono text-xs font-medium tabular-nums",
                    isProfit ? "text-green-500" : isLoss ? "text-red-500" : "text-muted-foreground",
                  )}
                >
                  {isProfit ? "+" : ""}
                  {r.realizedPL.toFixed(2)}
                </span>

                <span className="text-muted-foreground ml-auto text-[10px]">
                  {timeAgo(r.processedAt)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
