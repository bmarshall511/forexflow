"use client"

import type { AiAnalysisSections, AiActionButton } from "@fxflow/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CheckCircle2, Sparkles, Zap, Undo2 } from "lucide-react"

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
    <Badge variant="outline" className={cn("text-[10px] h-5", map[confidence])}>
      {confidence} confidence
    </Badge>
  )
}

// ─── Action Card ──────────────────────────────────────────────────────────────

function ActionButtonCard({ action, onApply, isApplied, isAutoApplied, isBelowThreshold, canUndo, onUndo }: {
  action: AiActionButton
  onApply: () => void
  isApplied?: boolean
  isAutoApplied?: boolean
  isBelowThreshold?: boolean
  canUndo?: boolean
  onUndo?: () => void
}) {
  return (
    <div className={cn("rounded-lg border p-3 space-y-2", isBelowThreshold && "opacity-70")}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium">{action.label}</span>
            <ConfidenceBadge confidence={action.confidence} />
            {isBelowThreshold && (
              <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">
                Below threshold
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{action.description}</p>
        </div>
        {isAutoApplied ? (
          <div className="flex items-center gap-1 text-xs text-purple-600 shrink-0">
            <Sparkles className="size-3" />
            Auto-applied
          </div>
        ) : isApplied ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="size-3" />
              Applied
            </div>
            {canUndo && onUndo && (
              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground" onClick={onUndo}>
                <Undo2 className="size-3" />
                Undo
              </Button>
            )}
          </div>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={onApply}>
            Apply
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground italic border-l-2 pl-2">{action.rationale}</p>
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
  // Filter out condition-type actions (they belong in the Conditions tab)
  const conditionTypes = new Set(["add_condition", "adjust_tp_partial"])
  const actions = (sections?.immediateActions ?? []).filter((a) => !conditionTypes.has(a.type))
  const hasActions = actions.length > 0 && tradeStatus !== "closed"

  if (!sections) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Zap className="size-10 text-muted-foreground/30" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No analysis yet</p>
          <p className="text-xs text-muted-foreground">
            Run an analysis to get suggested actions for this trade.
          </p>
        </div>
      </div>
    )
  }

  if (!hasActions) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Zap className="size-10 text-muted-foreground/30" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No actions suggested</p>
          <p className="text-xs text-muted-foreground">
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
      <p className="text-[11px] text-muted-foreground">
        One-time trade modifications you can apply now
      </p>

      {/* Auto-apply threshold info bar */}
      {autoApplyMinConfidence && (sections.autoAppliedActionIds?.length ?? 0) > 0 && (
        <div className="flex items-center gap-1.5 rounded-md bg-purple-500/5 border border-purple-500/20 px-3 py-1.5 text-[11px] text-purple-700">
          <Sparkles className="size-3 shrink-0" />
          <span>
            Actions at or above <strong>{autoApplyMinConfidence}</strong> confidence were auto-applied.
          </span>
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
