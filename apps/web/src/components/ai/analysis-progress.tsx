"use client"

import { useState, useEffect } from "react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Loader2, Square } from "lucide-react"
import type { AiAnalysisProgress } from "@/hooks/use-ai-analysis"

interface AnalysisProgressProps {
  progress: AiAnalysisProgress
  analysisId: string | null
  onCancel: (analysisId: string) => void
  /** Total expected duration in seconds (from model config) */
  estimatedSec?: number
  /** Date.now() timestamp when the analysis was triggered */
  startedAt?: number
}

export function AnalysisProgressDisplay({ progress, analysisId, onCancel, estimatedSec, startedAt }: AnalysisProgressProps) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!estimatedSec || !startedAt) {
      setRemaining(null)
      return
    }
    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000
      setRemaining(Math.max(0, Math.round(estimatedSec - elapsed)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [estimatedSec, startedAt])

  const countdownLabel =
    remaining === null ? null :
    remaining > 0 ? `~${remaining}s remaining` :
    "Almost done…"

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span>{progress.stage}</span>
          {countdownLabel && (
            <span className="text-xs text-muted-foreground font-normal">— {countdownLabel}</span>
          )}
        </div>
        {analysisId && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
            onClick={() => onCancel(analysisId)}
          >
            <Square className="size-3 fill-current" />
            Stop
          </Button>
        )}
      </div>

      <Progress value={progress.progress} className="h-1.5" />

      {progress.streamText && (
        <div className="rounded bg-muted p-3 max-h-40 overflow-y-auto">
          <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
            {progress.streamText}
          </pre>
        </div>
      )}
    </div>
  )
}
