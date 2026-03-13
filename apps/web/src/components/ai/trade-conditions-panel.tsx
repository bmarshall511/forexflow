"use client"

import { useState, useMemo } from "react"
import type { TradeConditionData, AiConditionSuggestion, TradeConditionTriggerType, TradeConditionActionType } from "@fxflow/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Plus, Trash2, Clock, TrendingUp, TrendingDown, Target, Bell, CheckCircle2, Sparkles, MoveUpRight } from "lucide-react"
import type { CreateConditionInput, UseTradeConditionsReturn } from "@/hooks/use-trade-conditions"
import { ConditionBuilder } from "./condition-builder"
import { ConditionPresets } from "./condition-presets"

interface TradeConditionsPanelProps {
  conditions: TradeConditionData[]
  tradeStatus: string
  hooks: Pick<UseTradeConditionsReturn, "createCondition" | "deleteCondition" | "refetch">
  /** AI-suggested conditions from the current analysis */
  conditionSuggestions?: AiConditionSuggestion[]
  /** ID of the analysis that generated the suggestions */
  analysisId?: string
  /** Trade data for presets — only needed for open trades */
  trade?: {
    id: string
    status: string
    direction: string
    entryPrice: number
    instrument: string
    currentUnits: number
  }
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  close_trade: <Target className="size-3" />,
  partial_close: <Target className="size-3" />,
  move_stop_loss: <TrendingDown className="size-3" />,
  move_take_profit: <TrendingUp className="size-3" />,
  cancel_order: <Target className="size-3" />,
  notify: <Bell className="size-3" />,
}

const TRIGGER_LABELS: Record<string, string> = {
  price_reaches: "Price reaches",
  price_breaks_above: "Price breaks above",
  price_breaks_below: "Price breaks below",
  pnl_pips: "P&L reaches",
  pnl_currency: "P&L ($) reaches",
  time_reached: "Time reached",
  duration_hours: "After duration",
  trailing_stop: "Trailing Stop",
}

const ACTION_LABELS: Record<string, string> = {
  close_trade: "Close Trade",
  partial_close: "Partial Close",
  move_stop_loss: "Move Stop Loss",
  move_take_profit: "Move Take Profit",
  cancel_order: "Cancel Order",
  notify: "Send Notification",
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  waiting: "bg-zinc-500/15 text-zinc-500 border-zinc-500/30",
  executing: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  triggered: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
}

function formatTriggerValue(triggerType: string, value: Record<string, unknown>): string {
  switch (triggerType) {
    case "price_reaches":
    case "price_breaks_above":
    case "price_breaks_below":
      return `${value.price as number}`
    case "pnl_pips": {
      const pipsDir = (value.direction as string) ?? "profit"
      return `${value.pips as number} pips ${pipsDir}`
    }
    case "pnl_currency": {
      const currDir = (value.direction as string) ?? "profit"
      return `$${value.amount as number} ${currDir}`
    }
    case "time_reached":
      return value.timestamp ? new Date(value.timestamp as string).toLocaleString() : "—"
    case "duration_hours":
      return `${value.hours as number}h after open`
    case "trailing_stop": {
      const dist = value.distance_pips as number
      const step = value.step_pips as number | undefined
      return step ? `${dist} pips (step: ${step})` : `${dist} pips`
    }
    default:
      return JSON.stringify(value)
  }
}

function ConditionCard({
  condition,
  onDelete,
  isChild,
  parentLabel,
}: {
  condition: TradeConditionData
  onDelete: () => void
  isChild?: boolean
  parentLabel?: string | null
}) {
  const isActive = condition.status === "active" || condition.status === "executing"
  const isWaiting = condition.status === "waiting"
  const isTrailingStop = condition.triggerType === "trailing_stop"

  return (
    <div className={cn("relative", isChild && "ml-5")}>
      {/* Chain connector line */}
      {isChild && (
        <div className="absolute -left-3 top-0 bottom-0 flex flex-col items-center">
          <div className="w-px h-3 bg-border" />
          <div className="w-2 h-px bg-border" />
        </div>
      )}

      <div className={cn(
        "rounded-lg border p-3 space-y-1.5",
        !isActive && !isWaiting && "opacity-60",
        isTrailingStop && "border-l-2 border-l-blue-500",
      )}>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            {condition.label && (
              <p className="text-xs font-medium truncate flex items-center gap-1">
                {isTrailingStop && <MoveUpRight className="size-3 text-blue-500 shrink-0" />}
                {condition.label}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              <span>{TRIGGER_LABELS[condition.triggerType] ?? condition.triggerType}</span>
              <span className="font-mono font-medium text-foreground">
                {formatTriggerValue(condition.triggerType, condition.triggerValue)}
              </span>
              <span>&rarr;</span>
              <span className="flex items-center gap-0.5">
                {ACTION_ICONS[condition.actionType]}
                {ACTION_LABELS[condition.actionType] ?? condition.actionType}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isWaiting ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className={cn("text-[9px] h-4 px-1 capitalize", STATUS_STYLES.waiting)}>
                      Waiting
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-48">
                    Activates after: {parentLabel ?? "parent condition"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Badge variant="outline" className={cn("text-[9px] h-4 px-1 capitalize", STATUS_STYLES[condition.status])}>
                {condition.status}
              </Badge>
            )}
            {(isActive || isWaiting) && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onDelete}>
                <Trash2 className="size-3 text-muted-foreground" />
                <span className="sr-only">Delete condition</span>
              </Button>
            )}
          </div>
        </div>
        {condition.expiresAt && (
          <p className="text-[10px] text-muted-foreground">
            Expires {new Date(condition.expiresAt).toLocaleString()}
          </p>
        )}
        {condition.triggeredAt && (
          <p className="text-[10px] text-blue-600">
            Triggered {new Date(condition.triggeredAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Condition Suggestion Card ────────────────────────────────────────────────

function ConditionSuggestionCard({
  suggestion,
  onAdd,
  isAdded,
  isAutoApplied,
}: {
  suggestion: AiConditionSuggestion
  onAdd: () => void
  isAdded?: boolean
  isAutoApplied?: boolean
}) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <span className="text-sm font-medium">{suggestion.label}</span>
          <p className="text-xs text-muted-foreground">{suggestion.rationale}</p>
        </div>
        {isAutoApplied ? (
          <div className="flex items-center gap-1 text-xs text-purple-600 shrink-0">
            <Sparkles className="size-3" />
            Auto-applied
          </div>
        ) : isAdded ? (
          <div className="flex items-center gap-1 text-xs text-emerald-600 shrink-0">
            <CheckCircle2 className="size-3" />
            Added
          </div>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" onClick={onAdd}>
            <Plus className="size-3" />
            Add
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Chain grouping helpers ──────────────────────────────────────────────────

interface ConditionGroup {
  parent: TradeConditionData
  children: TradeConditionData[]
}

function groupConditions(conditions: TradeConditionData[]): { groups: ConditionGroup[]; standalone: TradeConditionData[] } {
  const parentIds = new Set(conditions.filter((c) => c.parentConditionId).map((c) => c.parentConditionId!))
  const childMap = new Map<string, TradeConditionData[]>()

  for (const c of conditions) {
    if (c.parentConditionId) {
      const existing = childMap.get(c.parentConditionId) ?? []
      existing.push(c)
      childMap.set(c.parentConditionId, existing)
    }
  }

  const groups: ConditionGroup[] = []
  const grouped = new Set<string>()

  for (const c of conditions) {
    if (parentIds.has(c.id)) {
      groups.push({
        parent: c,
        children: childMap.get(c.id) ?? [],
      })
      grouped.add(c.id)
      for (const child of childMap.get(c.id) ?? []) {
        grouped.add(child.id)
      }
    }
  }

  // Children whose parent is not in the current list — show as standalone
  const standalone = conditions.filter((c) => !grouped.has(c.id))

  return { groups, standalone }
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function TradeConditionsPanel({ conditions, tradeStatus, hooks, conditionSuggestions, analysisId, trade }: TradeConditionsPanelProps) {
  const [showBuilder, setShowBuilder] = useState(false)
  const [addedSuggestionIndices, setAddedSuggestionIndices] = useState<Set<number>>(new Set())
  const canAdd = tradeStatus === "open" || tradeStatus === "pending"

  const activeConditions = conditions.filter((c) => c.status === "active" || c.status === "executing" || c.status === "waiting")
  const historicConditions = conditions.filter((c) => c.status !== "active" && c.status !== "executing" && c.status !== "waiting")

  const activeGrouped = useMemo(() => groupConditions(activeConditions), [activeConditions])
  const historicGrouped = useMemo(() => groupConditions(historicConditions), [historicConditions])

  const handleCreate = async (input: CreateConditionInput) => {
    await hooks.createCondition(input)
    setShowBuilder(false)
  }

  /** Check if a suggestion already exists as a condition */
  const getSuggestionState = (suggestion: AiConditionSuggestion): "auto-applied" | "user-added" | null => {
    if (!conditions.length) return null
    const match = conditions.find((c) =>
      c.status === "active" &&
      c.analysisId === analysisId &&
      c.label === suggestion.label
    )
    if (!match) return null
    return match.createdBy === "ai" ? "auto-applied" : "user-added"
  }

  const handleAddSuggestion = async (suggestion: AiConditionSuggestion, index: number) => {
    try {
      await hooks.createCondition({
        triggerType: suggestion.triggerType as TradeConditionTriggerType,
        triggerValue: suggestion.triggerValue,
        actionType: suggestion.actionType as TradeConditionActionType,
        actionParams: suggestion.actionParams,
        label: suggestion.label,
        analysisId,
      })
      setAddedSuggestionIndices((prev) => new Set([...prev, index]))
      toast.success(`Condition "${suggestion.label}" added`)
    } catch (err) {
      toast.error(`Failed to add condition: ${(err as Error).message}`)
    }
  }

  const findConditionLabel = (id: string | null) => {
    if (!id) return null
    return conditions.find((c) => c.id === id)?.label ?? null
  }

  const hasSuggestions = (conditionSuggestions?.length ?? 0) > 0 && tradeStatus !== "closed"
  const isEmpty = conditions.length === 0 && !hasSuggestions && !showBuilder

  const renderConditionGroup = (group: ConditionGroup, onDelete: (id: string) => void) => (
    <div key={group.parent.id} className="space-y-1">
      <ConditionCard
        condition={group.parent}
        onDelete={() => onDelete(group.parent.id)}
      />
      {group.children.map((child) => (
        <ConditionCard
          key={child.id}
          condition={child}
          onDelete={() => onDelete(child.id)}
          isChild
          parentLabel={group.parent.label}
        />
      ))}
    </div>
  )

  const renderStandaloneCondition = (condition: TradeConditionData, onDelete: (id: string) => void) => (
    <ConditionCard
      key={condition.id}
      condition={condition}
      onDelete={() => onDelete(condition.id)}
      isChild={!!condition.parentConditionId}
      parentLabel={findConditionLabel(condition.parentConditionId)}
    />
  )

  return (
    <div className="space-y-4">
      {canAdd && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowBuilder(!showBuilder)}
          >
            <Plus className="size-3" />
            Add Condition
          </Button>
        </div>
      )}

      {/* Presets — only for open trades */}
      {trade && tradeStatus === "open" && (
        <ConditionPresets trade={trade} onCreated={() => hooks.refetch()} />
      )}

      {showBuilder && (
        <>
          <ConditionBuilder
            tradeStatus={tradeStatus}
            onSubmit={handleCreate}
            onCancel={() => setShowBuilder(false)}
            existingConditions={activeConditions}
          />
          <Separator />
        </>
      )}

      {/* AI Suggested Conditions */}
      {hasSuggestions && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Suggested by AI</p>
          <p className="text-[11px] text-muted-foreground -mt-1">Automated rules that trigger when market conditions are met</p>
          {conditionSuggestions!.map((suggestion, i) => {
            const state = getSuggestionState(suggestion)
            return (
              <ConditionSuggestionCard
                key={i}
                suggestion={suggestion}
                onAdd={() => void handleAddSuggestion(suggestion, i)}
                isAdded={addedSuggestionIndices.has(i) || state === "user-added"}
                isAutoApplied={state === "auto-applied"}
              />
            )
          })}
          {activeConditions.length > 0 && <Separator />}
        </div>
      )}

      {activeConditions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active</p>
          {activeGrouped.groups.map((group) =>
            renderConditionGroup(group, (id) => void hooks.deleteCondition(id)),
          )}
          {activeGrouped.standalone.map((condition) =>
            renderStandaloneCondition(condition, (id) => void hooks.deleteCondition(id)),
          )}
        </div>
      )}

      {historicConditions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">History</p>
          {historicGrouped.groups.map((group) =>
            renderConditionGroup(group, (id) => void hooks.deleteCondition(id)),
          )}
          {historicGrouped.standalone.map((condition) =>
            renderStandaloneCondition(condition, (id) => void hooks.deleteCondition(id)),
          )}
        </div>
      )}

      {isEmpty && (
        <p className="text-center text-sm text-muted-foreground py-6">
          {canAdd ? "No conditions set. Add one to automate trade management." : "No conditions were set for this trade."}
        </p>
      )}
    </div>
  )
}
