"use client"

/**
 * Re-run reconciliation diff view.
 *
 * Renders the `reconciliationLog` of a v2 AiAnalysis as four grouped
 * sections: applied automatically (add/update/remove ops the system just
 * executed), kept unchanged (no-op "keep" ops), plus a brief summary of
 * new ideas. This gives the user a clear audit trail of "what changed
 * since the last analysis" instead of a flat bag of suggestions.
 *
 * Used by analysis-tab-content inside the sheet when the displayed
 * analysis has `schemaVersion === 2` and a non-empty log. Legacy v1
 * analyses bypass this entirely and render via AnalysisResults as before.
 */

import { useState } from "react"
import type { AiAnalysisData, AiReconciliationLogEntry } from "@fxflow/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, PlusCircle, Edit3, Trash2, ChevronDown, ChevronRight } from "lucide-react"

interface AnalysisDiffViewProps {
  analysis: AiAnalysisData
}

const OP_STYLES: Record<
  AiReconciliationLogEntry["op"],
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  keep: {
    label: "Kept",
    icon: CheckCircle2,
    tone: "text-muted-foreground",
  },
  update: {
    label: "Updated",
    icon: Edit3,
    tone: "text-blue-600 dark:text-blue-400",
  },
  remove: {
    label: "Removed",
    icon: Trash2,
    tone: "text-orange-600 dark:text-orange-400",
  },
  add: {
    label: "Added",
    icon: PlusCircle,
    tone: "text-emerald-600 dark:text-emerald-400",
  },
}

export function AnalysisDiffView({ analysis }: AnalysisDiffViewProps) {
  const log = analysis.reconciliationLog ?? []
  const [keepExpanded, setKeepExpanded] = useState(false)

  if (log.length === 0) return null

  const applied = log.filter((l) => l.op !== "keep")
  const kept = log.filter((l) => l.op === "keep")

  return (
    <section
      aria-labelledby="reconciliation-heading"
      className="bg-card space-y-3 rounded-lg border p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id="reconciliation-heading" className="text-sm font-semibold tracking-tight">
          Changes since last analysis
        </h3>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {applied.length} applied · {kept.length} kept
        </Badge>
      </div>

      {applied.length > 0 ? (
        <ul className="space-y-2" role="list">
          {applied.map((entry, i) => (
            <DiffRow
              key={`${entry.op}-${entry.existingId ?? entry.resultId ?? i}-${i}`}
              entry={entry}
            />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">
          The AI reviewed your existing conditions and decided nothing needed to change.
        </p>
      )}

      {kept.length > 0 && (
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 gap-1.5 px-1 text-xs"
            onClick={() => setKeepExpanded((v) => !v)}
            aria-expanded={keepExpanded}
            aria-controls="reconciliation-kept-list"
          >
            {keepExpanded ? (
              <ChevronDown className="size-3" aria-hidden />
            ) : (
              <ChevronRight className="size-3" aria-hidden />
            )}
            {kept.length} rule{kept.length === 1 ? "" : "s"} kept unchanged
          </Button>
          {keepExpanded && (
            <ul id="reconciliation-kept-list" className="space-y-2 pl-5" role="list">
              {kept.map((entry, i) => (
                <DiffRow key={`keep-${entry.existingId ?? i}-${i}`} entry={entry} muted />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function DiffRow({ entry, muted = false }: { entry: AiReconciliationLogEntry; muted?: boolean }) {
  const style = OP_STYLES[entry.op]
  const Icon = style.icon
  return (
    <li className="flex items-start gap-2">
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", style.tone)} aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("text-xs font-medium", muted && "text-muted-foreground")}>
            {entry.label}
          </span>
          <Badge variant="outline" className={cn("h-4 px-1 text-[9px] font-normal", style.tone)}>
            {style.label}
          </Badge>
        </div>
        <p
          className={cn(
            "text-[11px] leading-snug",
            muted ? "text-muted-foreground/80" : "text-muted-foreground",
          )}
        >
          {entry.reason}
        </p>
      </div>
    </li>
  )
}
