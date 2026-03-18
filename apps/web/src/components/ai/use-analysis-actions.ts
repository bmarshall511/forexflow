"use client"

import { useState, useEffect, useCallback } from "react"
import type {
  AiActionButton,
  AiAnalysisData,
  AiConditionSuggestion,
  OpenTradeData,
  PendingOrderData,
  ClosedTradeData,
} from "@fxflow/types"
import { extractPriceFromParams, extractPriceFromText, priceMatch } from "@fxflow/shared"
import { useTradeActions } from "@/hooks/use-trade-actions"
import { toast } from "sonner"

type TradeUnion = OpenTradeData | PendingOrderData | ClosedTradeData

interface AppliedAction {
  type: string
  prevSl?: number | null
  prevTp?: number | null
}

/**
 * Derive whether an action's effect is already reflected in the current trade data.
 * This makes "Applied" state survive sheet close/reopen without needing DB persistence.
 */
function isActionEffectApplied(action: AiActionButton, trade: TradeUnion): boolean {
  const p = action.params
  switch (action.type) {
    case "adjust_sl": {
      const target =
        ((p.price ?? p.stopLoss ?? p.sl ?? p.stop) as number | undefined) ??
        extractPriceFromParams(p)
      if (!target || !("stopLoss" in trade) || trade.stopLoss === null) return false
      return priceMatch(trade.stopLoss as number, target)
    }
    case "adjust_tp": {
      const target =
        ((p.price ?? p.takeProfit ?? p.tp ?? p.target ?? p.targetPrice) as number | undefined) ??
        extractPriceFromParams(p)
      if (!target || !("takeProfit" in trade) || trade.takeProfit === null) return false
      return priceMatch(trade.takeProfit as number, target)
    }
    case "move_to_breakeven": {
      if (!("stopLoss" in trade) || !("entryPrice" in trade) || trade.stopLoss === null)
        return false
      return priceMatch(trade.stopLoss as number, trade.entryPrice as number)
    }
    case "adjust_entry": {
      const target = extractPriceFromParams(p)
      if (!target || !("entryPrice" in trade)) return false
      return priceMatch(trade.entryPrice as number, target)
    }
    case "update_expiry": {
      if (!("timeInForce" in trade)) return false
      return (
        (trade as PendingOrderData).timeInForce === "GTD" &&
        (trade as PendingOrderData).gtdTime !== null
      )
    }
    case "partial_close": {
      if (!("currentUnits" in trade) || !("initialUnits" in trade)) return false
      return (trade as OpenTradeData).currentUnits < (trade as OpenTradeData).initialUnits
    }
    default:
      return false
  }
}

function extractUnits(p: Record<string, unknown>, fallbackTotal?: number): number | undefined {
  const unitVal = p.units ?? p.unitsToClose ?? p.closeUnits
  if (typeof unitVal === "number") return unitVal
  const pct = (p.percentage ?? p.percent) as number | undefined
  if (pct && fallbackTotal) return Math.round(fallbackTotal * (pct / 100))
  if (fallbackTotal) return Math.round(fallbackTotal / 2)
  return undefined
}

export interface UseAnalysisActionsReturn {
  appliedActionIds: Set<string>
  appliedActions: Map<string, AppliedAction>
  pendingActionId: string | null
  modifySltpOpen: boolean
  setModifySltpOpen: (open: boolean) => void
  modifySltpTarget: { sl?: number; tp?: number } | null
  closeTradeOpen: boolean
  setCloseTradeOpen: (open: boolean) => void
  partialCloseUnits: number | undefined
  actionLoading: boolean
  handleApplyAction: (action: AiActionButton) => void
  handleUndoAction: (actionId: string) => Promise<void>
  handleModifySltpConfirm: (sl: number | null, tp: number | null) => Promise<void>
  handleCloseTradeConfirm: (units?: number, reason?: string) => Promise<void>
  refreshPositions: () => Promise<void>
}

export function useAnalysisActions(
  trade: TradeUnion | null,
  tradeStatus: "open" | "pending" | "closed",
  displayAnalysis: AiAnalysisData | null,
): UseAnalysisActionsReturn {
  const tradeId = trade?.id ?? null
  const {
    modifyTrade,
    modifyPendingOrder,
    closeTrade,
    cancelOrder,
    isLoading: actionLoading,
    refreshPositions,
  } = useTradeActions()

  const [appliedActions, setAppliedActions] = useState<Map<string, AppliedAction>>(new Map())
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [modifySltpOpen, setModifySltpOpen] = useState(false)
  const [modifySltpTarget, setModifySltpTarget] = useState<{ sl?: number; tp?: number } | null>(
    null,
  )
  const [closeTradeOpen, setCloseTradeOpen] = useState(false)
  const [partialCloseUnits, setPartialCloseUnits] = useState<number | undefined>()

  // Reset state when trade changes
  useEffect(() => {
    setAppliedActions(new Map())
    setPendingActionId(null)
  }, [tradeId])

  const markApplied = useCallback(
    (id: string | null, meta?: AppliedAction) => {
      if (!id) return
      setAppliedActions((prev) => new Map([...prev, [id, meta ?? { type: "unknown" }]]))
      if (displayAnalysis?.id) {
        fetch(`/api/ai/recommendations/${displayAnalysis.id}`, { method: "POST" }).catch(() => {})
      }
    },
    [displayAnalysis?.id],
  )

  const markUndone = useCallback((id: string) => {
    setAppliedActions((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  // Compute effective applied IDs: merge ephemeral state + derived from trade data
  const appliedActionIds = new Set<string>([
    ...appliedActions.keys(),
    ...(displayAnalysis?.sections?.immediateActions ?? [])
      .filter((a) => trade && isActionEffectApplied(a, trade))
      .map((a) => a.id),
    ...(displayAnalysis?.sections?.autoAppliedActionIds ?? []),
  ])

  const handleApplyAction = useCallback(
    (action: AiActionButton) => {
      if (!trade) return
      setPendingActionId(action.id)

      const currentSl = "stopLoss" in trade ? (trade.stopLoss as number | null) : null
      const currentTp = "takeProfit" in trade ? (trade.takeProfit as number | null) : null
      const p = action.params

      switch (action.type) {
        case "adjust_sl":
        case "move_to_breakeven": {
          const sl =
            ((p.price ?? p.stopLoss ?? p.sl ?? p.stop) as number | undefined) ??
            (action.type === "move_to_breakeven" && "entryPrice" in trade
              ? (trade.entryPrice as number)
              : undefined) ??
            extractPriceFromParams(p)
          setModifySltpTarget({ sl })
          setModifySltpOpen(true)
          break
        }
        case "adjust_tp": {
          const tp =
            ((p.price ?? p.takeProfit ?? p.tp ?? p.target ?? p.targetPrice) as
              | number
              | undefined) ?? extractPriceFromParams(p)
          setModifySltpTarget({ tp })
          setModifySltpOpen(true)
          break
        }
        case "adjust_tp_partial":
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
            void cancelOrder(trade.sourceOrderId, `AI recommended: ${action.rationale}`).then(
              (ok) => {
                if (ok) {
                  markApplied(action.id, { type: action.type })
                  void refreshPositions()
                }
              },
            )
          }
          break
        }
        case "add_condition":
          break
        case "adjust_entry": {
          if (tradeStatus !== "pending" || !("sourceOrderId" in trade)) {
            toast.error("Entry price can only be adjusted on pending orders")
            break
          }
          const newEntry =
            extractPriceFromParams(p) ??
            (Object.values(p).find((v) => typeof v === "number") as number | undefined)
          if (!newEntry) {
            toast.error("No entry price found in action parameters")
            break
          }
          void modifyPendingOrder(trade.sourceOrderId, { entryPrice: newEntry }).then((ok) => {
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
          const expiryRaw = (p.expiry ??
            p.gtdTime ??
            p.expiryTime ??
            p.expirationTime ??
            p.expiration ??
            p.time ??
            p.datetime) as string | undefined
          const expiryHours = (p.hours ??
            p.durationHours ??
            p.duration ??
            p.expiryHours ??
            p.timeoutHours ??
            p.hoursFromNow) as number | undefined

          let gtdTime: string | null = null
          if (typeof expiryRaw === "string" && expiryRaw.length > 0) {
            const parsed = new Date(expiryRaw)
            if (!isNaN(parsed.getTime())) gtdTime = parsed.toISOString()
          }
          if (!gtdTime && typeof expiryHours === "number" && expiryHours > 0) {
            gtdTime = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString()
          }
          if (!gtdTime) {
            const text = `${action.label} ${action.description ?? ""}`
            const hourMatch = text.match(/(\d+)\s*(?:hr|hour)/i)
            if (hourMatch) {
              const hrs = parseInt(hourMatch[1]!, 10)
              if (hrs > 0 && hrs <= 720) {
                gtdTime = new Date(Date.now() + hrs * 60 * 60 * 1000).toISOString()
              }
            }
          }
          if (!gtdTime) {
            const numVal = Object.values(p).find(
              (v) => typeof v === "number" && v >= 1 && v <= 720,
            ) as number | undefined
            if (numVal) gtdTime = new Date(Date.now() + numVal * 60 * 60 * 1000).toISOString()
          }
          if (!gtdTime) {
            toast.error("Could not determine expiry time from action")
            break
          }
          void modifyPendingOrder(trade.sourceOrderId, { gtdTime }).then((ok) => {
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
    },
    [trade, tradeStatus, markApplied, cancelOrder, modifyPendingOrder, refreshPositions],
  )

  const handleUndoAction = useCallback(
    async (actionId: string) => {
      const applied = appliedActions.get(actionId)
      if (!applied || !trade) return

      const isReversible =
        applied.type === "adjust_sl" ||
        applied.type === "adjust_tp" ||
        applied.type === "adjust_tp_partial" ||
        applied.type === "move_to_breakeven"
      if (!isReversible) return

      try {
        let ok = false
        if (tradeStatus === "open" && "sourceTradeId" in trade) {
          ok = await modifyTrade(trade.sourceTradeId, {
            stopLoss: applied.prevSl ?? null,
            takeProfit: applied.prevTp ?? null,
          })
        } else if (tradeStatus === "pending" && "sourceOrderId" in trade) {
          ok = await modifyPendingOrder(trade.sourceOrderId, {
            stopLoss: applied.prevSl ?? null,
            takeProfit: applied.prevTp ?? null,
          })
        }
        if (ok) {
          markUndone(actionId)
          toast.success("Action reverted")
        }
      } catch {
        toast.error("Failed to revert action")
      }
    },
    [trade, tradeStatus, appliedActions, modifyTrade, modifyPendingOrder, markUndone],
  )

  const handleModifySltpConfirm = useCallback(
    async (sl: number | null, tp: number | null) => {
      if (!trade) return
      const prevSl = "stopLoss" in trade ? (trade.stopLoss as number | null) : null
      const prevTp = "takeProfit" in trade ? (trade.takeProfit as number | null) : null

      let ok = false
      if (tradeStatus === "open" && "sourceTradeId" in trade) {
        ok = await modifyTrade(trade.sourceTradeId, { stopLoss: sl, takeProfit: tp })
      } else if (tradeStatus === "pending" && "sourceOrderId" in trade) {
        ok = await modifyPendingOrder(trade.sourceOrderId, { stopLoss: sl, takeProfit: tp })
      }
      if (ok) {
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
    },
    [
      trade,
      tradeStatus,
      pendingActionId,
      displayAnalysis,
      modifyTrade,
      modifyPendingOrder,
      markApplied,
    ],
  )

  const handleCloseTradeConfirm = useCallback(
    async (units?: number, reason?: string) => {
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
    },
    [
      trade,
      tradeStatus,
      pendingActionId,
      partialCloseUnits,
      displayAnalysis,
      closeTrade,
      markApplied,
      refreshPositions,
    ],
  )

  return {
    appliedActionIds,
    appliedActions,
    pendingActionId,
    modifySltpOpen,
    setModifySltpOpen,
    modifySltpTarget,
    closeTradeOpen,
    setCloseTradeOpen,
    partialCloseUnits,
    actionLoading,
    handleApplyAction,
    handleUndoAction,
    handleModifySltpConfirm,
    handleCloseTradeConfirm,
    refreshPositions,
  }
}

/**
 * Convert add_condition and adjust_tp_partial actions into condition suggestions.
 * These are conditional rules, not instant actions — they belong in the Conditions tab.
 */
export function convertToConditionSuggestions(
  actions: AiActionButton[],
  trade: TradeUnion | null,
): AiConditionSuggestion[] {
  const conditionActionTypes = new Set(["add_condition", "adjust_tp_partial"])

  return actions
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
        const price =
          extractPriceFromParams(a.params) ?? extractPriceFromText(a.label, a.description)
        if (!price) return null
        const dir =
          trade && "direction" in trade
            ? (trade as OpenTradeData | PendingOrderData).direction
            : "long"
        const totalUnits = trade
          ? "currentUnits" in trade
            ? (trade as OpenTradeData).currentUnits
            : "units" in trade
              ? (trade as PendingOrderData).units
              : 0
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
}
