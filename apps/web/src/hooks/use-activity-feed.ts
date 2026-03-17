"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useDaemonStatus } from "./use-daemon-status"
import { usePositions } from "./use-positions"
import type { NotificationData } from "@fxflow/types"

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

// ─── Helpers ────────────────────────────────────────────────────────────────

function notificationToEvent(n: NotificationData): ActivityEvent {
  let type: ActivityEventType = "order_placed"
  if (n.source === "ai_analysis") type = "ai_analysis_completed"
  else if (n.source === "trade_condition") type = "condition_triggered"
  else if (n.source === "trade_finder") type = "trade_finder_setup"
  else if (n.source === "ai_trader") type = "ai_opportunity"
  else if (n.source === "tv_alerts") type = "tv_signal"
  else if (n.title.toLowerCase().includes("closed") || n.title.toLowerCase().includes("hit"))
    type = "trade_closed"
  else if (n.title.toLowerCase().includes("fill") || n.title.toLowerCase().includes("opened"))
    type = "trade_opened"

  const intent =
    n.severity === "critical"
      ? "negative"
      : n.severity === "warning"
        ? "warning"
        : type === "trade_closed" && n.title.toLowerCase().includes("loss")
          ? "negative"
          : type === "trade_closed"
            ? "positive"
            : "info"

  return {
    id: `notif-${n.id}`,
    type,
    title: n.title,
    detail: n.message || undefined,
    timestamp: n.createdAt,
    intent,
  }
}

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
  const [isLoading, setIsLoading] = useState(true)
  const seenIds = useRef(new Set<string>())
  const prevClosedIds = useRef(new Set<string>())
  const initialized = useRef(false)

  const addEvent = useCallback((event: ActivityEvent) => {
    if (seenIds.current.has(event.id)) return
    seenIds.current.add(event.id)
    setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS))
  }, [])

  // Hydrate from persisted notifications on mount (survives page refresh)
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    fetch("/api/notifications?limit=20")
      .then(async (res) => {
        if (!res.ok) return
        const json = await res.json()
        if (!json.ok || !json.data?.notifications) return
        const notifications = json.data.notifications as NotificationData[]
        const hydrated = notifications.map(notificationToEvent)
        for (const e of hydrated) seenIds.current.add(e.id)
        setEvents(hydrated)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  // Track closed trade IDs for real-time detection
  useEffect(() => {
    if (!positions?.closed) return
    if (prevClosedIds.current.size === 0) {
      prevClosedIds.current = new Set(positions.closed.map((t) => t.id))
      return
    }
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
    const dir = lastTVSignal.direction ? lastTVSignal.direction.toUpperCase() : "SIGNAL"
    const pair = lastTVSignal.instrument ? lastTVSignal.instrument.replace("_", "/") : ""
    addEvent({
      id: `tv-${lastTVSignal.id ?? Date.now()}`,
      type: "tv_signal",
      title: `TV Alert: ${dir}${pair ? ` ${pair}` : ""}`,
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
    const pair = lastAiTraderOpportunity.instrument?.replace("_", "/") ?? "unknown"
    const dir = lastAiTraderOpportunity.direction?.toUpperCase() ?? ""
    const conf = Math.round(lastAiTraderOpportunity.confidence ?? 0)
    addEvent({
      id: `ait-${lastAiTraderOpportunity.id ?? Date.now()}`,
      type: "ai_opportunity",
      title: `AI opportunity: ${pair}`,
      detail: `${dir} ${conf}%`.trim(),
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
    addEvent(notificationToEvent(n))
  }, [lastNotification, addEvent])

  return { events, isLoading }
}
