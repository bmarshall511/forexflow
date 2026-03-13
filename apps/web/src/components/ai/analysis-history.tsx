"use client"

import { ANALYSIS_STUCK_THRESHOLD_MS, type AiAnalysisData } from "@fxflow/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@fxflow/shared"
import { ChevronRight, AlertCircle, CheckCircle2, Clock, XCircle, AlertTriangle } from "lucide-react"

interface AnalysisHistoryProps {
  history: AiAnalysisData[]
  selectedId: string | null
  onSelect: (analysis: AiAnalysisData) => void
}

const MODEL_LABELS: Record<string, string> = {
  "claude-haiku-4-5-20251001": "Haiku",
  "claude-sonnet-4-6": "Sonnet",
  "claude-opus-4-6": "Opus",
}

const DEPTH_LABELS: Record<string, string> = {
  quick: "Quick",
  standard: "Standard",
  deep: "Deep",
}

/** An analysis is considered stuck if it's been pending/running for > 2 minutes */
function isStuck(analysis: AiAnalysisData): boolean {
  if (analysis.status !== "pending" && analysis.status !== "running") return false
  const age = Date.now() - new Date(analysis.createdAt).getTime()
  return age > ANALYSIS_STUCK_THRESHOLD_MS
}

function StatusIcon({ analysis }: { analysis: AiAnalysisData }) {
  if (isStuck(analysis)) {
    return <AlertTriangle className="size-3 text-amber-500" />
  }
  switch (analysis.status) {
    case "completed": return <CheckCircle2 className="size-3 text-emerald-500" />
    case "failed": return <AlertCircle className="size-3 text-red-500" />
    case "cancelled": return <XCircle className="size-3 text-muted-foreground" />
    case "running":
    case "pending": return <Clock className="size-3 text-blue-500 animate-pulse" />
  }
}

export function AnalysisHistory({ history, selectedId, onSelect }: AnalysisHistoryProps) {
  if (history.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No analyses yet. Run your first analysis above.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {history.map((analysis) => {
        const stuck = isStuck(analysis)
        return (
          <Button
            key={analysis.id}
            variant="ghost"
            className={cn(
              "w-full justify-between h-auto py-2 px-3 text-left",
              selectedId === analysis.id && "bg-muted",
            )}
            onClick={() => onSelect(analysis)}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <StatusIcon analysis={analysis} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium">
                    {MODEL_LABELS[analysis.model] ?? analysis.model} — {DEPTH_LABELS[analysis.depth] ?? analysis.depth}
                  </span>
                  <Badge variant="outline" className="h-4 text-[9px] px-1 font-normal capitalize">
                    {analysis.triggeredBy.replace("_", " ")}
                  </Badge>
                  {stuck && (
                    <Badge variant="outline" className="h-4 text-[9px] px-1 font-normal text-amber-600 border-amber-300">
                      Stuck
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{formatRelativeTime(analysis.createdAt)}</span>
                  {analysis.costUsd > 0 && (
                    <span>${analysis.costUsd.toFixed(4)}</span>
                  )}
                  {analysis.durationMs > 0 && (
                    <span>{(analysis.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </div>
                {/* Show error message preview for failed analyses */}
                {analysis.status === "failed" && analysis.errorMessage && (
                  <p className="text-[10px] text-red-500/80 truncate mt-0.5 max-w-[300px]">
                    {analysis.errorMessage}
                  </p>
                )}
                {stuck && (
                  <p className="text-[10px] text-amber-500/80 mt-0.5">
                    May have been interrupted — click to retry
                  </p>
                )}
              </div>
            </div>
            <ChevronRight className="size-3 text-muted-foreground shrink-0" />
          </Button>
        )
      })}
    </div>
  )
}
