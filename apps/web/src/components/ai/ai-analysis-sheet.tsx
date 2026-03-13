"use client"

import { useState, useEffect } from "react"
import type { AiClaudeModel, AiAnalysisDepth, AiAnalysisData, AiActionButton, AiConditionSuggestion, OpenTradeData, PendingOrderData, ClosedTradeData } from "@fxflow/types"
import { AI_MODEL_OPTIONS, ANALYSIS_STUCK_THRESHOLD_MS } from "@fxflow/types"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Sparkles, History, Target, AlertCircle, AlertTriangle, Settings, RefreshCw, Zap } from "lucide-react"
import { AnalysisModelSelector } from "./analysis-model-selector"
import { AnalysisProgressDisplay } from "./analysis-progress"
import { AnalysisResults } from "./analysis-results"
import { AnalysisHistory } from "./analysis-history"
import { ActionsPanel } from "./actions-panel"
import { TradeConditionsPanel } from "./trade-conditions-panel"
import { useAiAnalysis } from "@/hooks/use-ai-analysis"
import { useAiSettings } from "@/hooks/use-ai-settings"
import { useTradeConditions } from "@/hooks/use-trade-conditions"
import { useTradeActions } from "@/hooks/use-trade-actions"
import { usePositions } from "@/hooks/use-positions"
import { ModifySltpDialog } from "@/components/positions/modify-sltp-dialog"
import { CloseTradeDialog } from "@/components/positions/close-trade-dialog"

type TradeUnion = OpenTradeData | PendingOrderData | ClosedTradeData

interface AiAnalysisSheetProps {
  trade: TradeUnion | null
  tradeStatus: "open" | "pending" | "closed"
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Check if an analysis is stuck (pending/running for > 2 minutes without active progress) */
function isStuckAnalysis(analysis: AiAnalysisData | null, hasActiveProgress: boolean): boolean {
  if (!analysis || hasActiveProgress) return false
  if (analysis.status !== "pending" && analysis.status !== "running") return false
  const age = Date.now() - new Date(analysis.createdAt).getTime()
  return age > ANALYSIS_STUCK_THRESHOLD_MS
}

/** Price comparison with tolerance for floating-point rounding (5th decimal for forex pairs) */
function priceMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.00015
}

/**
 * Derive whether an action's effect is already reflected in the current trade data.
 * This makes "Applied" state survive sheet close/reopen without needing DB persistence.
 */
function isActionEffectApplied(action: AiActionButton, trade: TradeUnion): boolean {
  const p = action.params
  /** Extract any numeric value from params — exhaustive key search */
  const anyPrice = (): number | undefined => {
    const candidates = [
      p.price, p.takeProfit, p.stopLoss, p.tp, p.sl,
      p.targetPrice, p.target, p.entryPrice, p.entry, p.stop,
      p.partialTakeProfit, p.newStopLoss, p.triggerPrice, p.newEntryPrice, p.newPrice,
    ]
    for (const raw of candidates) {
      if (typeof raw === "number") return raw
    }
    return undefined
  }

  switch (action.type) {
    case "adjust_sl": {
      const target = (p.price ?? p.stopLoss ?? p.sl ?? p.stop) as number | undefined ?? anyPrice()
      if (!target || !("stopLoss" in trade) || trade.stopLoss === null) return false
      return priceMatch(trade.stopLoss as number, target)
    }
    case "adjust_tp": {
      const target = (p.price ?? p.takeProfit ?? p.tp ?? p.target ?? p.targetPrice) as number | undefined ?? anyPrice()
      if (!target || !("takeProfit" in trade) || trade.takeProfit === null) return false
      return priceMatch(trade.takeProfit as number, target)
    }
    case "move_to_breakeven": {
      if (!("stopLoss" in trade) || !("entryPrice" in trade) || trade.stopLoss === null) return false
      return priceMatch(trade.stopLoss as number, trade.entryPrice as number)
    }
    case "adjust_entry": {
      const target = anyPrice()
      if (!target || !("entryPrice" in trade)) return false
      return priceMatch(trade.entryPrice as number, target)
    }
    case "update_expiry": {
      // If the order now has GTD time set, treat as applied
      if (!("timeInForce" in trade)) return false
      return (trade as PendingOrderData).timeInForce === "GTD" && (trade as PendingOrderData).gtdTime !== null
    }
    case "adjust_tp_partial": {
      // This creates a condition — applied state is tracked via markApplied() ephemeral state
      // and persists visually because the condition shows in the Conditions tab
      return false
    }
    case "partial_close": {
      // If currentUnits < initialUnits, a partial close has occurred
      if (!("currentUnits" in trade) || !("initialUnits" in trade)) return false
      return (trade as OpenTradeData).currentUnits < (trade as OpenTradeData).initialUnits
    }
    default:
      return false
  }
}

export function AiAnalysisSheet({ trade, tradeStatus, open, onOpenChange }: AiAnalysisSheetProps) {
  const tradeId = trade?.id ?? null
  const { pricesByInstrument } = usePositions()
  const liveTick = trade ? pricesByInstrument.get(trade.instrument) ?? null : null
  const { settings: aiSettings, refetch: refetchSettings } = useAiSettings()
  const [selectedModel, setSelectedModel] = useState<AiClaudeModel>("claude-sonnet-4-6")
  const [selectedDepth, setSelectedDepth] = useState<AiAnalysisDepth>("standard")

  // Sync defaults from saved settings (only on first load, not on every settings change)
  useEffect(() => {
    if (!aiSettings) return
    setSelectedModel(aiSettings.autoAnalysis.defaultModel)
    setSelectedDepth(aiSettings.autoAnalysis.defaultDepth)
  }, [aiSettings?.autoAnalysis.defaultModel, aiSettings?.autoAnalysis.defaultDepth]) // eslint-disable-line react-hooks/exhaustive-deps
  const [viewedAnalysis, setViewedAnalysis] = useState<AiAnalysisData | null>(null)
  const [activeTab, setActiveTab] = useState("analysis")

  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null)
  const estimatedSec = AI_MODEL_OPTIONS.find((m) => m.id === selectedModel)?.estimatedDurationSec

  // Modify SL/TP dialog state
  const [modifySltpOpen, setModifySltpOpen] = useState(false)
  const [modifySltpTarget, setModifySltpTarget] = useState<{ sl?: number; tp?: number } | null>(null)
  const [closeTradeOpen, setCloseTradeOpen] = useState(false)
  const [partialCloseUnits, setPartialCloseUnits] = useState<number | undefined>()

  // Applied action tracking — stores previous state for undo
  interface AppliedAction {
    type: string
    prevSl?: number | null
    prevTp?: number | null
  }
  const [appliedActions, setAppliedActions] = useState<Map<string, AppliedAction>>(new Map())
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  // Reset state when trade changes
  useEffect(() => {
    setAppliedActions(new Map())
    setViewedAnalysis(null)
    setPendingActionId(null)
  }, [tradeId])

  const markApplied = (id: string | null, meta?: AppliedAction) => {
    if (!id) return
    setAppliedActions((prev) => new Map([...prev, [id, meta ?? { type: "unknown" }]]))

    // Track that user followed an AI recommendation (non-blocking)
    if (displayAnalysis?.id) {
      fetch(`/api/ai/recommendations/${displayAnalysis.id}`, { method: "POST" }).catch(() => {})
    }
  }

  const markUndone = (id: string) => {
    setAppliedActions((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }

  const { history, progress, activeAnalysis, isLoading, isTriggeringAnalysis, triggerAnalysis, cancelAnalysis } =
    useAiAnalysis(tradeId)
  const conditionHooks = useTradeConditions(tradeId)
  const { modifyTrade, modifyPendingOrder, closeTrade, cancelOrder, isLoading: actionLoading, refreshPositions } = useTradeActions()

  // The analysis to display: viewed from history OR the latest completed/failed/stuck
  const displayAnalysis = viewedAnalysis ?? (history.find((a) =>
    a.status === "completed" || a.status === "failed" || a.status === "pending" || a.status === "running"
  ) ?? null)

  // Compute effective applied IDs: merge ephemeral state + derived from trade data
  // This makes "Applied" state survive sheet close/reopen
  const appliedActionIds = new Set<string>([
    ...appliedActions.keys(),
    ...(displayAnalysis?.sections?.immediateActions ?? [])
      .filter((a) => trade && isActionEffectApplied(a, trade))
      .map((a) => a.id),
  ])

  const isAutoDisabled = !!aiSettings?.autoAnalysis.autoDisabledReason
  const stuck = isStuckAnalysis(displayAnalysis, !!progress)

  const handleTrigger = async () => {
    const id = await triggerAnalysis({ model: selectedModel, depth: selectedDepth })
    if (id) {
      setAnalysisStartedAt(Date.now())
      setViewedAnalysis(null) // clear history view so progress shows
      setActiveTab("analysis")
    } else {
      toast.error("Failed to start analysis. Is the daemon running and Claude API key configured?")
    }
  }

  const handleReEnable = async () => {
    try {
      await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "re-enable-auto" }),
      })
      refetchSettings()
      toast.success("Auto-analysis re-enabled")
    } catch {
      toast.error("Failed to re-enable auto-analysis")
    }
  }

  // Clear startedAt when analysis finishes + refetch conditions (auto-apply may have created some)
  useEffect(() => {
    if (!progress) {
      setAnalysisStartedAt(null)
      conditionHooks.refetch()
    }
  }, [progress]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Extract a price from action params — Claude uses many different key names.
   *  Built from actual Claude output analysis: partialTakeProfit, newStopLoss, triggerPrice, etc. */
  const extractPrice = (p: Record<string, unknown>): number | undefined => {
    const candidates = [
      p.price, p.takeProfit, p.stopLoss, p.tp, p.sl,
      p.targetPrice, p.target, p.entryPrice, p.entry, p.stop,
      // Keys from actual Claude outputs:
      p.partialTakeProfit, p.newStopLoss, p.triggerPrice,
      p.remainingTakeProfit, p.newEntryPrice, p.newPrice,
    ]
    for (const raw of candidates) {
      if (typeof raw === "number") return raw
    }
    return undefined
  }

  /** Extract a price specifically from the action description text (e.g. "at 0.8079") */
  const extractPriceFromText = (action: AiActionButton): number | undefined => {
    const text = `${action.label ?? ""} ${action.description ?? ""}`
    const match = text.match(/(?:at|@)\s*([\d.]+)/i)
    if (match) {
      const parsed = parseFloat(match[1]!)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
    return undefined
  }

  const extractUnits = (p: Record<string, unknown>, fallbackTotal?: number): number | undefined => {
    // Check explicit unit keys
    const unitVal = p.units ?? p.unitsToClose ?? p.closeUnits
    if (typeof unitVal === "number") return unitVal
    // Check percentage
    const pct = (p.percentage ?? p.percent) as number | undefined
    if (pct && fallbackTotal) return Math.round(fallbackTotal * (pct / 100))
    // Default to 50% of total if nothing specified
    if (fallbackTotal) return Math.round(fallbackTotal / 2)
    return undefined
  }

  const handleApplyAction = (action: AiActionButton) => {
    if (!trade) return
    setPendingActionId(action.id)

    // Capture current SL/TP for undo
    const currentSl = "stopLoss" in trade ? (trade.stopLoss as number | null) : null
    const currentTp = "takeProfit" in trade ? (trade.takeProfit as number | null) : null
    const p = action.params

    switch (action.type) {
      case "adjust_sl":
      case "move_to_breakeven": {
        // For move_to_breakeven, fall back to entryPrice if no SL-specific param
        const sl = (p.price ?? p.stopLoss ?? p.sl ?? p.stop) as number | undefined
          ?? (action.type === "move_to_breakeven" && "entryPrice" in trade ? trade.entryPrice as number : undefined)
          ?? extractPrice(p)
        setModifySltpTarget({ sl })
        setModifySltpOpen(true)
        break
      }
      case "adjust_tp": {
        const tp = (p.price ?? p.takeProfit ?? p.tp ?? p.target ?? p.targetPrice) as number | undefined
          ?? extractPrice(p)
        setModifySltpTarget({ tp })
        setModifySltpOpen(true)
        break
      }
      case "adjust_tp_partial":
        // Converted to condition suggestion — handled in Conditions tab
        break
      case "close_trade": {
        setPartialCloseUnits(undefined)
        setCloseTradeOpen(true)
        break
      }
      case "partial_close": {
        if ("sourceTradeId" in trade) {
          const units = extractUnits(p, (trade as OpenTradeData).currentUnits)
          setPartialCloseUnits(units)
          setCloseTradeOpen(true)
        }
        break
      }
      case "cancel_order": {
        if ("sourceOrderId" in trade) {
          void cancelOrder(trade.sourceOrderId, `AI recommended: ${action.rationale}`)
            .then((ok) => {
              if (ok) {
                markApplied(action.id, { type: action.type })
                void refreshPositions()
              }
            })
        }
        break
      }
      case "add_condition":
        // Handled in Conditions tab — should not appear in Actions tab
        break
      case "adjust_entry": {
        if (tradeStatus !== "pending" || !("sourceOrderId" in trade)) {
          toast.error("Entry price can only be adjusted on pending orders")
          break
        }
        // Use exhaustive param extraction — Claude uses many key names
        const newEntry = extractPrice(p)
        if (!newEntry) {
          // Still try: look for any numeric value in params as last resort
          const numericVal = Object.values(p).find((v) => typeof v === "number") as number | undefined
          if (numericVal) {
            void modifyPendingOrder(trade.sourceOrderId, { entryPrice: numericVal })
              .then((ok) => {
                if (ok) {
                  markApplied(action.id, { type: action.type, prevSl: currentSl, prevTp: currentTp })
                  void refreshPositions()
                }
              })
          } else {
            toast.error("No entry price found in action parameters")
          }
          break
        }
        void modifyPendingOrder(trade.sourceOrderId, { entryPrice: newEntry })
          .then((ok) => {
            if (ok) {
              markApplied(action.id, { type: action.type, prevSl: currentSl, prevTp: currentTp })
              void refreshPositions()
            }
          })
        break
      }
      case "update_expiry": {
        if (tradeStatus !== "pending" || !("sourceOrderId" in trade)) {
          toast.error("Expiry can only be updated on pending orders")
          break
        }
        // Handle multiple param formats Claude might use for expiry
        // Absolute datetime strings
        const expiryRaw = (p.expiry ?? p.gtdTime ?? p.expiryTime ?? p.expirationTime
          ?? p.expiration ?? p.time ?? p.datetime) as string | undefined
        // Relative hours
        const expiryHours = (p.hours ?? p.durationHours ?? p.duration ?? p.expiryHours
          ?? p.timeoutHours ?? p.hoursFromNow) as number | undefined

        let gtdTime: string | null = null
        if (typeof expiryRaw === "string" && expiryRaw.length > 0) {
          const parsed = new Date(expiryRaw)
          if (!isNaN(parsed.getTime())) {
            gtdTime = parsed.toISOString()
          }
        }
        if (!gtdTime && typeof expiryHours === "number" && expiryHours > 0) {
          gtdTime = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString()
        }
        // Last resort: check the action label/description for hour patterns like "48hr" or "24 hour"
        if (!gtdTime) {
          const text = `${action.label} ${action.description ?? ""}`
          const hourMatch = text.match(/(\d+)\s*(?:hr|hour)/i)
          if (hourMatch) {
            const hrs = parseInt(hourMatch[1]!, 10)
            if (hrs > 0 && hrs <= 720) { // max 30 days
              gtdTime = new Date(Date.now() + hrs * 60 * 60 * 1000).toISOString()
            }
          }
        }
        // Final last resort: any numeric param that looks like hours (1-720)
        if (!gtdTime) {
          const numVal = Object.values(p).find((v) => typeof v === "number" && v >= 1 && v <= 720) as number | undefined
          if (numVal) {
            gtdTime = new Date(Date.now() + numVal * 60 * 60 * 1000).toISOString()
          }
        }
        if (!gtdTime) {
          toast.error("Could not determine expiry time from action")
          break
        }
        void modifyPendingOrder(trade.sourceOrderId, { gtdTime })
          .then((ok) => {
            if (ok) {
              markApplied(action.id, { type: action.type })
              void refreshPositions()
            }
          })
        break
      }
      default:
        toast.info(action.label)
    }

    // currentSl/currentTp are used by adjust_entry for undo tracking
  }

  const handleUndoAction = async (actionId: string) => {
    const applied = appliedActions.get(actionId)
    if (!applied || !trade) return

    const isReversible = applied.type === "adjust_sl" || applied.type === "adjust_tp" ||
      applied.type === "adjust_tp_partial" || applied.type === "move_to_breakeven"
    if (!isReversible) return

    try {
      const prevSl = applied.prevSl
      const prevTp = applied.prevTp
      let ok = false
      if (tradeStatus === "open" && "sourceTradeId" in trade) {
        ok = await modifyTrade(trade.sourceTradeId, { stopLoss: prevSl ?? null, takeProfit: prevTp ?? null })
      } else if (tradeStatus === "pending" && "sourceOrderId" in trade) {
        ok = await modifyPendingOrder(trade.sourceOrderId, { stopLoss: prevSl ?? null, takeProfit: prevTp ?? null })
      }
      if (ok) {
        markUndone(actionId)
        toast.success("Action reverted")
      }
    } catch {
      toast.error("Failed to revert action")
    }
  }

  const handleModifySltpConfirm = async (sl: number | null, tp: number | null) => {
    if (!trade) return
    // Capture previous values before modifying
    const prevSl = "stopLoss" in trade ? (trade.stopLoss as number | null) : null
    const prevTp = "takeProfit" in trade ? (trade.takeProfit as number | null) : null

    let ok = false
    if (tradeStatus === "open" && "sourceTradeId" in trade) {
      ok = await modifyTrade(trade.sourceTradeId, { stopLoss: sl, takeProfit: tp })
    } else if (tradeStatus === "pending" && "sourceOrderId" in trade) {
      ok = await modifyPendingOrder(trade.sourceOrderId, { stopLoss: sl, takeProfit: tp })
    }
    if (ok) {
      // Find which action type triggered this dialog
      const actions = displayAnalysis?.sections?.immediateActions ?? []
      const matchedAction = actions.find((a) => a.id === pendingActionId)
      markApplied(pendingActionId, {
        type: matchedAction?.type ?? "adjust_sl",
        prevSl,
        prevTp,
      })
      setModifySltpOpen(false)
      setModifySltpTarget(null)
      setPendingActionId(null)
    }
    // If not ok: useTradeActions already shows a toast error; dialog stays open so user can retry
  }

  const handleCloseTradeConfirm = async (units?: number, reason?: string) => {
    if (!trade || tradeStatus !== "open" || !("sourceTradeId" in trade)) return
    const ok = await closeTrade(trade.sourceTradeId, units ?? partialCloseUnits, reason)
    if (ok) {
      const actions = displayAnalysis?.sections?.immediateActions ?? []
      const matchedAction = actions.find((a) => a.id === pendingActionId)
      markApplied(pendingActionId, { type: matchedAction?.type ?? "close_trade" })
      setCloseTradeOpen(false)
      setPendingActionId(null)
      void refreshPositions()
    }
  }

  const pair = trade?.instrument.replace("_", "/") ?? "—"

  // Convert add_condition and adjust_tp_partial actions into condition suggestions.
  // These are conditional rules, not instant actions — they belong in the Conditions tab.
  const conditionActionTypes = new Set(["add_condition", "adjust_tp_partial"])
  const allActions = displayAnalysis?.sections?.immediateActions ?? []

  const convertedConditionSuggestions: AiConditionSuggestion[] = allActions
    .filter((a) => conditionActionTypes.has(a.type))
    .map((a): AiConditionSuggestion | null => {
      if (a.type === "add_condition" && a.params.triggerType && a.params.actionType) {
        return {
          label: a.label,
          triggerType: a.params.triggerType as string,
          triggerValue: (a.params.triggerValue as Record<string, unknown>) ?? {},
          actionType: a.params.actionType as string,
          actionParams: (a.params.actionParams as Record<string, unknown>) ?? {},
          confidence: a.confidence,
          rationale: a.rationale,
        }
      }
      if (a.type === "adjust_tp_partial") {
        const price = extractPrice(a.params) ?? extractPriceFromText(a)
        if (!price) return null
        const dir = trade && "direction" in trade ? (trade as OpenTradeData | PendingOrderData).direction : "long"
        const totalUnits = trade
          ? ("currentUnits" in trade ? (trade as OpenTradeData).currentUnits
            : "units" in trade ? (trade as PendingOrderData).units : 0)
          : 0
        const units = extractUnits(a.params, totalUnits)
        return {
          label: a.label,
          triggerType: dir === "long" ? "price_breaks_above" : "price_breaks_below",
          triggerValue: { price },
          actionType: "partial_close",
          actionParams: { units: units ?? Math.round(totalUnits / 2) },
          confidence: a.confidence,
          rationale: a.rationale,
        }
      }
      return null
    })
    .filter((s): s is AiConditionSuggestion => s !== null)

  const mergedConditionSuggestions = [
    ...(displayAnalysis?.sections?.conditionSuggestions ?? []),
    ...convertedConditionSuggestions,
  ]

  // Count only actionable actions for badge (exclude condition-type actions)
  const actionableActions = allActions.filter((a) => !conditionActionTypes.has(a.type))

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                AI Analysis
              </SheetTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs capitalize">{tradeStatus}</Badge>
                <span className="text-sm font-mono font-medium">{pair}</span>
              </div>
            </div>
            <SheetDescription className="sr-only">
              AI-powered trade analysis for {pair}
            </SheetDescription>

            {/* Auto-disable warning banner */}
            {isAutoDisabled && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 flex items-start gap-2">
                <AlertTriangle className="size-4 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-red-600">Auto-analysis disabled due to repeated failures</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {aiSettings?.autoAnalysis.autoDisabledReason}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => void handleReEnable()}>
                      <RefreshCw className="size-3" />
                      Re-enable
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" asChild>
                      <a href="/settings/ai">
                        <Settings className="size-3" />
                        Settings
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Model selector + Analyze button */}
            {tradeStatus !== "closed" && (
              <div className="flex flex-wrap items-center gap-2">
                <AnalysisModelSelector
                  model={selectedModel}
                  depth={selectedDepth}
                  onModelChange={setSelectedModel}
                  onDepthChange={setSelectedDepth}
                  disabled={isTriggeringAnalysis || !!progress}
                />
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => void handleTrigger()}
                  disabled={isTriggeringAnalysis || !!progress || !tradeId}
                >
                  <Sparkles className="size-3" />
                  {progress ? "Analyzing…" : isTriggeringAnalysis ? "Starting…" : "Analyze"}
                </Button>
              </div>
            )}
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="shrink-0 mx-6 mt-3 h-8 grid w-auto grid-cols-4 bg-muted/50">
              <TabsTrigger value="analysis" className="text-xs gap-1">
                <Sparkles className="size-3" />
                Analysis
              </TabsTrigger>
              <TabsTrigger value="actions" className="text-xs gap-1">
                <Zap className="size-3" />
                Actions
                {actionableActions.length > 0 && tradeStatus !== "closed" && (
                  <Badge variant="secondary" className="h-4 text-[9px] px-1 ml-0.5">
                    {actionableActions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="conditions" className="text-xs gap-1">
                <Target className="size-3" />
                Conditions
                {conditionHooks.conditions.filter((c) => c.status === "active" || c.status === "executing" || c.status === "waiting").length > 0 && (
                  <Badge variant="secondary" className="h-4 text-[9px] px-1 ml-0.5">
                    {conditionHooks.conditions.filter((c) => c.status === "active" || c.status === "executing" || c.status === "waiting").length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs gap-1">
                <History className="size-3" />
                History
                {history.length > 0 && (
                  <Badge variant="secondary" className="h-4 text-[9px] px-1 ml-0.5">{history.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Analysis Tab */}
            <TabsContent value="analysis" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full">
                <div className="px-6 py-4 space-y-4">
                  {/* Progress */}
                  {progress && (
                    <AnalysisProgressDisplay
                      progress={progress}
                      analysisId={activeAnalysis?.id ?? null}
                      onCancel={(id) => void cancelAnalysis(id)}
                      estimatedSec={estimatedSec}
                      startedAt={analysisStartedAt ?? undefined}
                    />
                  )}

                  {/* Loading skeleton */}
                  {isLoading && !progress && (
                    <div className="space-y-3">
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  )}

                  {/* Results */}
                  {!progress && !isLoading && displayAnalysis?.sections && (
                    <>
                      {displayAnalysis !== (history[0]) && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted rounded px-3 py-1.5">
                          <span>Viewing historical analysis from {new Date(displayAnalysis.createdAt).toLocaleDateString()}</span>
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setViewedAnalysis(null)}>
                            View latest
                          </Button>
                        </div>
                      )}
                      <AnalysisResults
                        sections={displayAnalysis.sections}
                        lastTick={liveTick}
                        trade={trade && "direction" in trade ? {
                          instrument: trade.instrument,
                          direction: (trade as OpenTradeData | PendingOrderData).direction,
                          entryPrice: (trade as OpenTradeData | PendingOrderData).entryPrice,
                          currentPrice: "currentPrice" in trade ? (trade as OpenTradeData).currentPrice : null,
                          stopLoss: "stopLoss" in trade ? (trade as OpenTradeData | PendingOrderData).stopLoss : null,
                          takeProfit: "takeProfit" in trade ? (trade as OpenTradeData | PendingOrderData).takeProfit : null,
                          timeframe: "timeframe" in trade ? (trade as OpenTradeData).timeframe : null,
                          openedAt: "openedAt" in trade ? (trade as OpenTradeData).openedAt : null,
                        } : null}
                      />
                    </>
                  )}

                  {/* Completed but parsing failed (legacy data with status=completed but null sections) */}
                  {!progress && !isLoading && displayAnalysis && displayAnalysis.status === "completed" && !displayAnalysis.sections && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-2">
                      <AlertCircle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Analysis completed but results couldn&apos;t be processed</p>
                        <p className="text-xs text-muted-foreground">
                          The AI returned a response, but it couldn&apos;t be parsed correctly. This can happen occasionally.
                        </p>
                        {tradeStatus !== "closed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => void handleTrigger()}
                            disabled={isTriggeringAnalysis || !!progress}
                          >
                            <Sparkles className="size-3" />
                            Retry Analysis
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Failed analysis — error banner with full details */}
                  {!progress && !isLoading && displayAnalysis?.status === "failed" && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-2">
                      <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
                      <div className="space-y-2 flex-1 min-w-0">
                        <p className="text-sm font-medium text-destructive">Analysis failed</p>
                        <p className="text-xs text-muted-foreground">{displayAnalysis.errorMessage ?? "Unknown error"}</p>
                        <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                          <span>{new Date(displayAnalysis.createdAt).toLocaleString()}</span>
                          <span>·</span>
                          <span className="capitalize">{displayAnalysis.triggeredBy.replace("_", " ")}</span>
                          <span>·</span>
                          <span>{displayAnalysis.model.includes("haiku") ? "Haiku" : displayAnalysis.model.includes("sonnet") ? "Sonnet" : "Opus"}</span>
                          <span>·</span>
                          <span className="capitalize">{displayAnalysis.depth}</span>
                        </div>
                        {tradeStatus !== "closed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => void handleTrigger()}
                            disabled={isTriggeringAnalysis || !!progress}
                          >
                            <RefreshCw className="size-3" />
                            Retry Analysis
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stuck analysis — pending/running but no active progress */}
                  {!progress && !isLoading && stuck && displayAnalysis && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-2">
                      <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="space-y-2 flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-600">This analysis appears stuck</p>
                        <p className="text-xs text-muted-foreground">
                          Started {new Date(displayAnalysis.createdAt).toLocaleString()} but hasn&apos;t received updates.
                          It may have been interrupted by a daemon restart.
                        </p>
                        {tradeStatus !== "closed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => void handleTrigger()}
                            disabled={isTriggeringAnalysis || !!progress}
                          >
                            <RefreshCw className="size-3" />
                            Retry Analysis
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {!progress && !isLoading && !displayAnalysis && (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                      <Sparkles className="size-10 text-muted-foreground/30" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">No analysis yet</p>
                        <p className="text-xs text-muted-foreground">
                          Select a model and click Analyze to get AI insights on this {tradeStatus === "pending" ? "pending order" : "trade"}.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Actions Tab */}
            <TabsContent value="actions" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full">
                <div className="px-6 py-4">
                  <ActionsPanel
                    sections={displayAnalysis?.sections ?? null}
                    tradeStatus={tradeStatus}
                    onApplyAction={handleApplyAction}
                    appliedActionIds={appliedActionIds}
                    appliedActions={appliedActions}
                    onUndoAction={(id) => void handleUndoAction(id)}
                    autoApplyMinConfidence={
                      aiSettings?.autoAnalysis.practiceAutoApplyEnabled || aiSettings?.autoAnalysis.liveAutoApplyEnabled
                        ? aiSettings.autoAnalysis.autoApplyMinConfidence ?? "high"
                        : null
                    }
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Conditions Tab */}
            <TabsContent value="conditions" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full">
                <div className="px-6 py-4">
                  <TradeConditionsPanel
                    conditions={conditionHooks.conditions}
                    tradeStatus={tradeStatus}
                    hooks={conditionHooks}
                    conditionSuggestions={mergedConditionSuggestions.length > 0 ? mergedConditionSuggestions : undefined}
                    analysisId={displayAnalysis?.id}
                    trade={trade && tradeStatus === "open" && "currentUnits" in trade ? {
                      id: trade.id,
                      status: tradeStatus,
                      direction: trade.direction,
                      entryPrice: trade.entryPrice,
                      instrument: trade.instrument,
                      currentUnits: trade.currentUnits,
                    } : undefined}
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full">
                <div className="px-6 py-4">
                  <AnalysisHistory
                    history={history}
                    selectedId={viewedAnalysis?.id ?? null}
                    onSelect={(analysis) => {
                      setViewedAnalysis(analysis)
                      setActiveTab("analysis")
                    }}
                  />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Modify SL/TP dialog — works for both open trades AND pending orders */}
      {trade && (tradeStatus === "open" || tradeStatus === "pending") && (
        <ModifySltpDialog
          trade={trade as OpenTradeData}
          open={modifySltpOpen}
          onOpenChange={setModifySltpOpen}
          onConfirm={(sl, tp) => void handleModifySltpConfirm(sl, tp)}
          isLoading={actionLoading}
          initialSl={modifySltpTarget?.sl}
          initialTp={modifySltpTarget?.tp}
        />
      )}

      {/* Close trade dialog — only available for open trades */}
      {trade && tradeStatus === "open" && "sourceTradeId" in trade && (
        <CloseTradeDialog
          trade={trade as OpenTradeData}
          open={closeTradeOpen}
          onOpenChange={setCloseTradeOpen}
          onConfirm={(units, reason) => void handleCloseTradeConfirm(units, reason)}
          isLoading={actionLoading}
        />
      )}
    </>
  )
}
