"use client"

import type { AiTraderConfidenceBucket } from "@fxflow/db"
import { cn } from "@/lib/utils"

interface Props {
  data: AiTraderConfidenceBucket[]
}

export function PerformanceConfidence({ data }: Props) {
  if (data.every((b) => b.count === 0)) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">No confidence data yet.</div>
    )
  }

  const maxCount = Math.max(...data.map((b) => b.count), 1)

  return (
    <section aria-label="Performance by confidence level">
      <h3 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
        By Confidence
      </h3>
      <div className="space-y-2">
        {data.map((b) => (
          <div key={b.bucket} className="bg-card rounded-lg border px-3 py-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">{b.bucket}%</span>
              <div className="flex items-center gap-3 text-xs tabular-nums">
                <span>
                  WR:{" "}
                  <strong
                    className={cn(
                      b.winRate >= 0.5 ? "text-emerald-500" : b.count > 0 ? "text-red-500" : "",
                    )}
                  >
                    {(b.winRate * 100).toFixed(0)}%
                  </strong>
                </span>
                <span className="text-muted-foreground">
                  {b.count} trade{b.count !== 1 ? "s" : ""}
                </span>
                <span className={b.totalPL >= 0 ? "text-emerald-500" : "text-red-500"}>
                  {b.totalPL >= 0 ? "+" : ""}${b.totalPL.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  b.winRate >= 0.5 ? "bg-emerald-500" : "bg-red-500",
                )}
                style={{ width: `${(b.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
