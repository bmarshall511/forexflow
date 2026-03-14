"use client"

import { cn } from "@/lib/utils"
import { SectionCard } from "@/components/ui/section-card"
import { GitCompareArrows, AlertTriangle } from "lucide-react"
import type { CorrelationEntry } from "@/hooks/use-risk-dashboard"
import { formatInstrument } from "@fxflow/shared"

interface CorrelationMatrixProps {
  entries: CorrelationEntry[]
  instruments: string[]
}

function getCorrColor(corr: number): string {
  const abs = Math.abs(corr)
  if (abs >= 0.7) return "bg-red-500/20 text-red-400"
  if (abs >= 0.5) return "bg-amber-500/20 text-amber-400"
  return "bg-emerald-500/20 text-emerald-400"
}

function getCorrLabel(corr: number): string {
  const abs = Math.abs(corr)
  if (abs >= 0.7) return "High"
  if (abs >= 0.5) return "Moderate"
  return "Low"
}

export function CorrelationMatrix({ entries, instruments }: CorrelationMatrixProps) {
  const dangerousEntries = entries.filter((e) => Math.abs(e.correlation) >= 0.7 && e.sameDirection)

  return (
    <SectionCard icon={GitCompareArrows} title="Correlation Warnings">
      <div className="space-y-3">
        {/* Danger alert */}
        {dangerousEntries.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2.5">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-red-400">Correlated Exposure Detected</p>
              <p className="text-[10px] text-red-400/80">
                {dangerousEntries.length} pair{dangerousEntries.length > 1 ? "s" : ""} with high
                correlation trading in amplifying directions. This multiplies your risk.
              </p>
            </div>
          </div>
        )}

        {/* Correlation list */}
        {entries.length > 0 ? (
          <div className="space-y-1.5">
            {entries.map((entry) => (
              <div
                key={`${entry.pairA}-${entry.pairB}`}
                className={cn(
                  "flex items-center justify-between rounded-md border px-2.5 py-2",
                  entry.sameDirection && Math.abs(entry.correlation) >= 0.7
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-border/50",
                )}
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium">{formatInstrument(entry.pairA)}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="font-medium">{formatInstrument(entry.pairB)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-[10px] font-medium",
                      getCorrColor(entry.correlation),
                    )}
                  >
                    {entry.correlation > 0 ? "+" : ""}
                    {entry.correlation.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground text-[10px]">
                    {getCorrLabel(entry.correlation)}
                  </span>
                  {entry.sameDirection && Math.abs(entry.correlation) >= 0.7 && (
                    <span className="text-[10px] font-medium text-red-400">Amplifying</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : instruments.length < 2 ? (
          <p className="text-muted-foreground py-4 text-center text-xs">
            Need at least 2 open positions to analyze correlations
          </p>
        ) : (
          <p className="text-muted-foreground py-4 text-center text-xs">
            No significant correlations between open positions
          </p>
        )}
      </div>
    </SectionCard>
  )
}
