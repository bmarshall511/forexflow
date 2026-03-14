"use client"

import type { AiAnalysisData } from "@fxflow/types"
import type { ActiveAnalysisProgress } from "@/hooks/use-active-ai-analyses"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Sparkles, AlertCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface AiAnalysisCellProps {
  latestAnalysis?: AiAnalysisData
  analysisCount?: number
  activeProgress?: ActiveAnalysisProgress
  onClick: () => void
}

export function AiAnalysisCell({
  latestAnalysis,
  analysisCount,
  activeProgress,
  onClick,
}: AiAnalysisCellProps) {
  const status = latestAnalysis?.status

  // ── State 1: Live WS progress (real-time streaming) ───────────────────────
  if (activeProgress) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-primary/60 flex items-center gap-1"
          >
            <Sparkles className="size-3 animate-pulse" />
            <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
              {activeProgress.progress}%
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-48 text-xs">
          {activeProgress.stage}
        </TooltipContent>
      </Tooltip>
    )
  }

  // ── State 2: DB shows running/pending (page loaded mid-analysis) ──────────
  if (status === "running" || status === "pending") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-primary/60 flex items-center gap-1"
          >
            <Loader2 className="size-3 animate-spin" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          Analysis in progress…
        </TooltipContent>
      </Tooltip>
    )
  }

  // ── State 3: Failed analysis ──────────────────────────────────────────────
  if (status === "failed") {
    const count = analysisCount ?? 0
    // If there are completed analyses in history, show sparkle with error indicator
    // rather than just a red icon — so users know there IS useful data to view
    if (count > 0) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClick()
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-primary/60 hover:text-primary flex items-center gap-1 transition-colors"
            >
              <Sparkles className="size-3" />
              <AlertCircle className="size-2.5 text-red-500/70" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-52 text-xs">
            <span className="text-red-500">Latest analysis failed</span>
            <span className="text-muted-foreground block">{count} completed</span>
          </TooltipContent>
        </Tooltip>
      )
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-red-500/70 transition-colors hover:text-red-500"
          >
            <AlertCircle className="size-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-52 text-xs">
          <span className="text-red-500">Analysis failed</span>
          {latestAnalysis?.errorMessage && (
            <span className="text-muted-foreground block truncate">
              {latestAnalysis.errorMessage}
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    )
  }

  // ── State 4: Completed analysis ───────────────────────────────────────────
  if (latestAnalysis && status === "completed") {
    const count = analysisCount ?? 1
    const tooltipText = latestAnalysis.sections
      ? `Win ${latestAnalysis.sections.winProbability}% · Q ${latestAnalysis.sections.tradeQualityScore}/10${count > 1 ? ` · ${count} analyses` : ""}`
      : "View analysis"

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(
              "flex items-center gap-1 transition-colors",
              "text-primary/60 hover:text-primary",
            )}
          >
            <Sparkles className="size-3" />
            {count > 1 && (
              <span className="text-muted-foreground text-[10px] font-semibold">{count}</span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    )
  }

  // ── State 5: Has completed analyses but latest is cancelled/unknown ──────
  const completedCount = analysisCount ?? 0
  if (completedCount > 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-primary/60 hover:text-primary flex items-center gap-1 transition-colors"
          >
            <Sparkles className="size-3" />
            {completedCount > 1 && (
              <span className="text-muted-foreground text-[10px] font-semibold">
                {completedCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          {completedCount} completed {completedCount === 1 ? "analysis" : "analyses"}
        </TooltipContent>
      </Tooltip>
    )
  }

  // ── State 6: No analysis at all ────────────────────────────────────────────
  return <span className="text-muted-foreground">—</span>
}
