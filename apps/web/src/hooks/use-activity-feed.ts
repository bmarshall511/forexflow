"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useDaemonStatus } from "./use-daemon-status"
import { usePositions } from "./use-positions"

// ─── Types ──────────────────────────────────────────────────────────────────

export type ActivityEventType =
  | "trade_closed"
  | "trade_opened"
  | "order_placed"
  | "tv_signal"
  | "ai_opportunity"
  | "trade_finder_setup"
  | "ai_analysis_completed"
  | "price_alert"
  | "condition_triggered"

export interface ActivityEvent {
  id: string
  type: ActivityEventType
  title: string
  detail?: string
  timestamp: string
  /** Color intent for the icon */
  intent: "positive" | "negative" | "neutral" | "info" | "warning"
}

const MAX_EVENTS = 30

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface UseActivityFeedReturn {
  events: ActivityEvent[]
  isLoading: boolean
}

export function useActivityFeed(): UseActivityFeedReturn {
  const {
    lastNotification,
    lastTVSignal,
    lastAiAnalysisCompleted,
    lastTradeFinderSetup,
    lastAiTraderOpportunity,
    lastConditionTriggered,
  } = useDaemonStatus()
  const { positions } = usePositions()

  const [events, setEvents] = useState<ActivityEvent[]>([])
  const seenIds = useRef(new Set<string>())
  const prevClosedIds = useRef(new Set<string>())
  const initialized = useRef(false)

  const addEvent = useCallback((event: ActivityEvent) => {
    if (seenIds.current.has(event.id)) return
    seenIds.current.add(event.id)
    setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS))
  }, [])

  // Seed initial events from closed trades (on first positions load)
  useEffect(() => {
    if (!positions?.closed || initialized.current) return
    initialized.current = true

    const closed = positions.closed.slice(0, 5)
    prevClosedIds.current = new Set(positions.closed.map((t) => t.id))

    const initial: ActivityEvent[] = closed.map((t) => ({
      id: `closed-${t.id}`,
      type: "trade_closed" as const,
      title: `${t.instrument.replace("_", "/")} ${t.direction} closed`,
      detail: t.outcome === "win" ? "Profit" : t.outcome === "loss" ? "Loss" : "Breakeven",
      timestamp: t.closedAt ?? t.openedAt,
      intent: t.outcome === "win" ? "positive" : t.outcome === "loss" ? "negative" : "neutral",
    }))
    setEvents(initial)
  }, [positions?.closed])

  // Detect newly closed trades (real-time)
  useEffect(() => {
    if (!positions?.closed) return
    for (const trade of positions.closed) {
      if (prevClosedIds.current.has(trade.id)) continue
      prevClosedIds.current.add(trade.id)
      addEvent({
        id: `closed-${trade.id}`,
        type: "trade_closed",
        title: `${trade.instrument.replace("_", "/")} ${trade.direction} closed`,
        detail:
          trade.outcome === "win" ? "Profit" : trade.outcome === "loss" ? "Loss" : "Breakeven",
        timestamp: trade.closedAt ?? trade.openedAt,
        intent:
          trade.outcome === "win" ? "positive" : trade.outcome === "loss" ? "negative" : "neutral",
      })
    }
  }, [positions?.closed, addEvent])

  // TV Alert signals
  useEffect(() => {
    if (!lastTVSignal) return
    addEvent({
      id: `tv-${lastTVSignal.id}`,
      type: "tv_signal",
      title: `TV Alert: ${lastTVSignal.direction.toUpperCase()} ${lastTVSignal.instrument.replace("_", "/")}`,
      timestamp: new Date().toISOString(),
      intent: "info",
    })
  }, [lastTVSignal, addEvent])

  // AI Analysis completed
  useEffect(() => {
    if (!lastAiAnalysisCompleted) return
    addEvent({
      id: `ai-${lastAiAnalysisCompleted.analysisId}`,
      type: "ai_analysis_completed",
      title: `AI analysis completed`,
      detail: `Trade ${lastAiAnalysisCompleted.tradeId.slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      intent: "info",
    })
  }, [lastAiAnalysisCompleted, addEvent])

  // Trade Finder setup
  useEffect(() => {
    if (!lastTradeFinderSetup) return
    addEvent({
      id: `tf-${lastTradeFinderSetup.id}`,
      type: "trade_finder_setup",
      title: `Setup found: ${lastTradeFinderSetup.instrument.replace("_", "/")}`,
      detail: `Score: ${lastTradeFinderSetup.scores.total}`,
      timestamp: new Date().toISOString(),
      intent: "info",
    })
  }, [lastTradeFinderSetup, addEvent])

  // AI Trader opportunity
  useEffect(() => {
    if (!lastAiTraderOpportunity) return
    addEvent({
      id: `ait-${lastAiTraderOpportunity.id}`,
      type: "ai_opportunity",
      title: `AI opportunity: ${lastAiTraderOpportunity.instrument.replace("_", "/")}`,
      detail: `${lastAiTraderOpportunity.direction.toUpperCase()} ${Math.round(lastAiTraderOpportunity.confidence)}%`,
      timestamp: new Date().toISOString(),
      intent: "warning",
    })
  }, [lastAiTraderOpportunity, addEvent])

  // Condition triggered
  useEffect(() => {
    if (!lastConditionTriggered) return
    addEvent({
      id: `cond-${lastConditionTriggered.conditionId}-${Date.now()}`,
      type: "condition_triggered",
      title: `Condition triggered`,
      detail: lastConditionTriggered.label ?? undefined,
      timestamp: new Date().toISOString(),
      intent: "warning",
    })
  }, [lastConditionTriggered, addEvent])

  // Notification-based events (trade fills, cancels, etc.)
  useEffect(() => {
    if (!lastNotification) return
    const n = lastNotification
    // Skip if already tracked by specific handlers
    if (n.source === "ai_analysis" || n.source === "trade_condition") return

    addEvent({
      id: `notif-${n.id}`,
      type: n.source === "oanda_stream" ? "trade_opened" : "order_placed",
      title: n.title,
      detail: n.message || undefined,
      timestamp: n.createdAt,
      intent:
        n.severity === "critical" ? "negative" : n.severity === "warning" ? "warning" : "info",
    })
  }, [lastNotification, addEvent])

  return { events, isLoading: !initialized.current && !positions }
}
