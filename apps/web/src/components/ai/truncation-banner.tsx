"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TruncationBannerProps {
  /**
   * Anthropic `stop_reason` from the analysis row (when available). Used to
   * tailor the copy between "hit the model token ceiling" and "unknown early
   * termination" without making the caller reach into metadata.
   */
  stopReason?: string | null
  /** Whether the trade is closed — disables the retry button (nothing to do). */
  tradeClosed: boolean
  /** Whether another analysis is already in flight — disables the retry button. */
  isTriggeringAnalysis: boolean
  /** Invoked when the user clicks "Regenerate". */
  onRetry: () => void
}

/**
 * Surfaced above a partial analysis result. Tells the user (in plain English)
 * that Claude's response was cut off before it finished, which sections may be
 * missing, and offers a one-click regenerate. Paired with section-level
 * "not generated" placeholders rendered by AnalysisResults when fields are
 * absent from `sections`.
 *
 * Exists because the prior executor silently promoted truncated responses to
 * `status: "completed"` and let the UI render whatever half-baked JSON landed.
 * Users then saw incomplete recommendations with no indication that the
 * response had been cut off — which is exactly the scenario that produced the
 * April 15 complaint.
 */
export function TruncationBanner({
  stopReason,
  tradeClosed,
  isTriggeringAnalysis,
  onRetry,
}: TruncationBannerProps) {
  const hitTokenCeiling = stopReason === "max_tokens"

  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"
      role="alert"
      aria-live="polite"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
          Analysis was cut off before it finished
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {hitTokenCeiling
            ? "Claude hit its response size limit while writing this analysis. The sections you see below are complete, but the recommendations, condition suggestions, or post-mortem may be missing or incomplete."
            : "The response ended unexpectedly before all sections were written. Some fields below may be missing or partial."}{" "}
          Regenerating usually fixes it — the system will request the model&apos;s maximum response
          size and retry.
        </p>
        {!tradeClosed && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="min-h-9 gap-1.5 text-xs"
              onClick={onRetry}
              disabled={isTriggeringAnalysis}
            >
              <RefreshCw className="size-3" />
              Regenerate Analysis
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
