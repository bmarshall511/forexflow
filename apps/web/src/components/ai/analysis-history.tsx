"use client"

import type { AiAnalysisData } from "@fxflow/types"
import {
  isStuckAnalysis,
  isInterruptedError,
  getAnalysisStatusConfig,
  MODEL_LABELS,
  DEPTH_LABELS,
} from "@fxflow/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@fxflow/shared"
import {
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  PauseCircle,
} from "lucide-react"

interface AnalysisHistoryProps {
  history: AiAnalysisData[]
  selectedId: string | null
  onSelect: (analysis: AiAnalysisData) => void
}

const ICON_MAP = {
  "check-circle-2": CheckCircle2,
  "alert-circle": AlertCircle,
  "x-circle": XCircle,
  clock: Clock,
  "alert-triangle": AlertTriangle,
  "pause-circle": PauseCircle,
} as const

function StatusIcon({ analysis }: { analysis: AiAnalysisData }) {
  const config = getAnalysisStatusConfig(
    analysis.status as Parameters<typeof getAnalysisStatusConfig>[0],
    {
      createdAt: analysis.createdAt,
      errorMessage: analysis.errorMessage,
    },
  )
  const Icon = ICON_MAP[config.iconName]
  const animate = analysis.status === "running" || analysis.status === "pending"
  return (
    <Icon
      className={cn(
        "size-3",
        config.colorClass,
        animate &&
          !isStuckAnalysis(
            analysis.createdAt,
            analysis.status as Parameters<typeof isStuckAnalysis>[1],
          ) &&
          "animate-pulse",
      )}
    />
  )
}

export function AnalysisHistory({ history, selectedId, onSelect }: AnalysisHistoryProps) {
  if (history.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No analyses yet. Run your first analysis above.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {history.map((analysis) => {
        const stuck = isStuckAnalysis(
          analysis.createdAt,
          analysis.status as Parameters<typeof isStuckAnalysis>[1],
        )
        // Distinguish "interrupted" (daemon crash, stream stall) from a real
        // analysis failure — interruptions are transient and retry-worthy.
        const interrupted =
          analysis.status === "failed" && isInterruptedError(analysis.errorMessage)
        const cancelled = analysis.status === "cancelled"
        const partial = analysis.status === "partial"
        return (
          <Button
            key={analysis.id}
            variant="ghost"
            className={cn(
              "h-auto w-full justify-between px-3 py-2 text-left",
              selectedId === analysis.id && "bg-muted",
            )}
            onClick={() => onSelect(analysis)}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <StatusIcon analysis={analysis} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium">
                    {MODEL_LABELS[analysis.model] ?? analysis.model} —{" "}
                    {DEPTH_LABELS[analysis.depth] ?? analysis.depth}
                  </span>
                  <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal capitalize">
                    {analysis.triggeredBy.replace("_", " ")}
                  </Badge>
                  {stuck && (
                    <Badge
                      variant="outline"
                      className="h-4 border-amber-300 px-1 text-[9px] font-normal text-amber-600"
                    >
                      Stuck
                    </Badge>
                  )}
                  {interrupted && (
                    <Badge
                      variant="outline"
                      className="h-4 border-orange-300 px-1 text-[9px] font-normal text-orange-600 dark:border-orange-500/40 dark:text-orange-400"
                    >
                      Interrupted
                    </Badge>
                  )}
                  {cancelled && (
                    <Badge
                      variant="outline"
                      className="text-muted-foreground h-4 px-1 text-[9px] font-normal"
                    >
                      Cancelled
                    </Badge>
                  )}
                  {partial && (
                    <Badge
                      variant="outline"
                      className="h-4 border-amber-300 px-1 text-[9px] font-normal text-amber-600 dark:border-amber-500/40 dark:text-amber-400"
                    >
                      Partial
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-[10px]">
                  <span>{formatRelativeTime(analysis.createdAt)}</span>
                  {analysis.costUsd > 0 && <span>${analysis.costUsd.toFixed(4)}</span>}
                  {analysis.durationMs > 0 && (
                    <span>{(analysis.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </div>
                {analysis.status === "failed" && !interrupted && analysis.errorMessage && (
                  <p className="mt-0.5 max-w-[300px] truncate text-[10px] text-red-500/80">
                    {analysis.errorMessage}
                  </p>
                )}
                {interrupted && (
                  <p className="mt-0.5 text-[10px] text-orange-500/80">
                    Daemon was restarted — click to retry
                  </p>
                )}
                {stuck && !interrupted && (
                  <p className="mt-0.5 text-[10px] text-amber-500/80">
                    May have been interrupted — click to retry
                  </p>
                )}
              </div>
            </div>
            <ChevronRight className="text-muted-foreground size-3 shrink-0" />
          </Button>
        )
      })}
    </div>
  )
}
