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

export function AnalysisProgressDisplay({
  progress,
  analysisId,
  onCancel,
  estimatedSec,
  startedAt,
}: AnalysisProgressProps) {
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
    remaining === null ? null : remaining > 0 ? `~${remaining}s remaining` : "Almost done…"

  return (
    <div className="bg-card space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="text-primary size-4 animate-spin" />
          <span>{progress.stage}</span>
          {countdownLabel && (
            <span className="text-muted-foreground text-xs font-normal">— {countdownLabel}</span>
          )}
        </div>
        {analysisId && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60 h-7 gap-1.5 text-xs"
            onClick={() => onCancel(analysisId)}
          >
            <Square className="size-3 fill-current" />
            Stop
          </Button>
        )}
      </div>

      <Progress value={progress.progress} className="h-1.5" />

      {progress.streamText && (
        <div className="bg-muted max-h-40 overflow-y-auto rounded p-3">
          <pre className="text-muted-foreground whitespace-pre-wrap font-mono text-[10px] leading-relaxed">
            {progress.streamText}
          </pre>
        </div>
      )}
    </div>
  )
}
