"use client"

import { useRef, useEffect } from "react"
import type { AiAnalysisSections, AiActionButton } from "@fxflow/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CheckCircle2, Sparkles, Zap, Undo2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

/** Metadata stored for each applied action so we can undo it */
interface AppliedAction {
  type: string
  prevSl?: number | null
  prevTp?: number | null
}

const REVERSIBLE_TYPES = new Set(["adjust_sl", "adjust_tp", "move_to_breakeven"])

interface ActionsPanelProps {
  sections: AiAnalysisSections | null
  tradeStatus: string
  onApplyAction: (action: AiActionButton) => void
  appliedActionIds: Set<string>
  appliedActions: Map<string, AppliedAction>
  onUndoAction: (actionId: string) => void
  autoApplyMinConfidence: "high" | "medium" | "low" | null
}

// ─── Confidence Badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  const map = {
    high: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    medium: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    low: "bg-muted text-muted-foreground",
  }
  return (
    <Badge variant="outline" className={cn("h-5 text-[10px]", map[confidence])}>
      {confidence} confidence
    </Badge>
  )
}

// ─── Action Card ──────────────────────────────────────────────────────────────

function ActionButtonCard({
  action,
  onApply,
  isApplied,
  isAutoApplied,
  isBelowThreshold,
  canUndo,
  onUndo,
}: {
  action: AiActionButton
  onApply: () => void
  isApplied?: boolean
  isAutoApplied?: boolean
  isBelowThreshold?: boolean
  canUndo?: boolean
  onUndo?: () => void
}) {
  return (
    <div className={cn("space-y-2 rounded-lg border p-3", isBelowThreshold && "opacity-70")}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">{action.label}</span>
            <ConfidenceBadge confidence={action.confidence} />
            {isBelowThreshold && (
              <Badge variant="outline" className="text-muted-foreground h-5 text-[10px]">
                Below threshold
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs">{action.description}</p>
        </div>
        {isAutoApplied ? (
          <div className="flex shrink-0 items-center gap-1 text-xs text-purple-600">
            <Sparkles className="size-3" />
            Auto-applied
          </div>
        ) : isApplied ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="size-3" />
              Applied
            </div>
            {canUndo && onUndo && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground h-6 gap-1 px-1.5 text-[10px]"
                onClick={onUndo}
              >
                <Undo2 className="size-3" />
                Undo
              </Button>
            )}
          </div>
        ) : (
          <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={onApply}>
            Apply
          </Button>
        )}
      </div>
      <p className="text-muted-foreground border-l-2 pl-2 text-xs italic">{action.rationale}</p>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function ActionsPanel({
  sections,
  tradeStatus,
  onApplyAction,
  appliedActionIds,
  appliedActions,
  onUndoAction,
  autoApplyMinConfidence,
}: ActionsPanelProps) {
  // Show toast for auto-apply errors on first render (ref-guarded)
  const toastedErrorsRef = useRef(false)
  useEffect(() => {
    if (
      !toastedErrorsRef.current &&
      sections?.autoApplyErrors &&
      sections.autoApplyErrors.length > 0
    ) {
      toastedErrorsRef.current = true
      for (const err of sections.autoApplyErrors) {
        toast.warning(`Auto-apply failed: ${err.label}`, { description: err.error })
      }
    }
  }, [sections?.autoApplyErrors])
  // Filter out condition-type actions (they belong in the Conditions tab)
  const conditionTypes = new Set(["add_condition", "adjust_tp_partial"])
  const actions = (sections?.immediateActions ?? []).filter((a) => !conditionTypes.has(a.type))
  const hasActions = actions.length > 0 && tradeStatus !== "closed"

  if (!sections) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Zap className="text-muted-foreground/30 size-10" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No analysis yet</p>
          <p className="text-muted-foreground text-xs">
            Run an analysis to get suggested actions for this trade.
          </p>
        </div>
      </div>
    )
  }

  if (!hasActions) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Zap className="text-muted-foreground/30 size-10" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No actions suggested</p>
          <p className="text-muted-foreground text-xs">
            {tradeStatus === "closed"
              ? "Actions are not available for closed trades."
              : "The AI did not suggest any immediate actions for this trade."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-[11px]">
        One-time trade modifications you can apply now
      </p>

      {/* Auto-apply threshold info bar */}
      {autoApplyMinConfidence && (sections.autoAppliedActionIds?.length ?? 0) > 0 && (
        <div className="flex items-center gap-1.5 rounded-md border border-purple-500/20 bg-purple-500/5 px-3 py-1.5 text-[11px] text-purple-700">
          <Sparkles className="size-3 shrink-0" />
          <span>
            Actions at or above <strong>{autoApplyMinConfidence}</strong> confidence were
            auto-applied.
          </span>
        </div>
      )}

      {/* Auto-apply error warnings */}
      {sections.autoApplyErrors && sections.autoApplyErrors.length > 0 && (
        <div className="space-y-1 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
            <AlertTriangle className="size-3 shrink-0" />
            {sections.autoApplyErrors.length} auto-apply action(s) failed
          </div>
          {sections.autoApplyErrors.map((err) => (
            <p key={err.actionId} className="text-[10px] text-amber-600/80">
              {err.label}: {err.error}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {actions.map((action) => {
          const confRank: Record<string, number> = { high: 3, medium: 2, low: 1 }
          const minRank = autoApplyMinConfidence ? (confRank[autoApplyMinConfidence] ?? 3) : 0
          const actionRank = confRank[action.confidence] ?? 0
          const belowThreshold = autoApplyMinConfidence
            ? actionRank < minRank && !sections.autoAppliedActionIds?.includes(action.id)
            : false

          const appliedMeta = appliedActions.get(action.id)
          const canUndo = !!appliedMeta && REVERSIBLE_TYPES.has(appliedMeta.type)

          return (
            <ActionButtonCard
              key={action.id}
              action={action}
              onApply={() => onApplyAction(action)}
              isApplied={appliedActionIds.has(action.id)}
              isAutoApplied={sections.autoAppliedActionIds?.includes(action.id)}
              isBelowThreshold={belowThreshold}
              canUndo={canUndo}
              onUndo={() => onUndoAction(action.id)}
            />
          )
        })}
      </div>
    </div>
  )
}
