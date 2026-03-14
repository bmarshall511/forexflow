"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import type { ChartGridLayout, ChartPanelConfig, ChartLayoutData } from "@fxflow/types"

const DAEMON_REST_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100")
    : ""

const LAYOUT_PANEL_COUNTS: Record<ChartGridLayout, number> = {
  single: 1,
  "2-horizontal": 2,
  "2-vertical": 2,
  "3-left": 3,
  "4-grid": 4,
  "6-grid": 6,
}

const DEFAULT_INSTRUMENTS = ["EUR_USD", "GBP_USD", "USD_JPY", "AUD_USD", "USD_CAD", "NZD_USD"]

function defaultPanel(index: number): ChartPanelConfig {
  return {
    instrument: DEFAULT_INSTRUMENTS[index % DEFAULT_INSTRUMENTS.length] ?? "EUR_USD",
    timeframe: "H1",
  }
}

function ensurePanelCount(panels: ChartPanelConfig[], count: number): ChartPanelConfig[] {
  if (panels.length === count) return panels
  if (panels.length > count) return panels.slice(0, count)
  const result = [...panels]
  while (result.length < count) {
    result.push(defaultPanel(result.length))
  }
  return result
}

export interface UseChartLayoutReturn {
  layout: ChartLayoutData
  isLoading: boolean
  setLayout: (layout: ChartGridLayout) => void
  setPanel: (index: number, config: Partial<ChartPanelConfig>) => void
  panelCount: number
  /** Update daemon price subscriptions with extra instruments (e.g. from assigned trades) */
  syncSubscriptions: (extraInstruments: string[]) => void
}

export function useChartLayout(): UseChartLayoutReturn {
  const [data, setData] = useState<ChartLayoutData>({
    layout: "single",
    panels: [defaultPanel(0)],
  })
  const [isLoading, setIsLoading] = useState(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const subscriptionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch layout from API on mount
  useEffect(() => {
    let cancelled = false
    fetch("/api/chart-layout")
      .then((res) => res.json())
      .then((json: { ok: boolean; data?: ChartLayoutData }) => {
        if (cancelled || !json.ok || !json.data) return
        const count = LAYOUT_PANEL_COUNTS[json.data.layout] ?? 1
        setData({
          layout: json.data.layout,
          panels: ensurePanelCount(json.data.panels, count),
        })
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Debounced save
  const scheduleSave = useCallback((newData: ChartLayoutData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      fetch("/api/chart-layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newData),
      }).catch(() => {})
    }, 500)
  }, [])

  // Extra instruments from assigned trades (set via syncSubscriptions)
  const extraInstrumentsRef = useRef<string[]>([])

  // Update chart subscriptions at daemon
  const updateSubscriptions = useCallback(
    (panels: ChartPanelConfig[], extra: string[] = extraInstrumentsRef.current) => {
      if (subscriptionTimerRef.current) clearTimeout(subscriptionTimerRef.current)
      subscriptionTimerRef.current = setTimeout(() => {
        const instruments = [...new Set([...panels.map((p) => p.instrument), ...extra])]
        if (DAEMON_REST_URL) {
          fetch(`${DAEMON_REST_URL}/chart-subscriptions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ instruments }),
          }).catch(() => {})
        }
      }, 300)
    },
    [],
  )

  // Subscribe on initial load
  useEffect(() => {
    if (!isLoading) {
      updateSubscriptions(data.panels)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (subscriptionTimerRef.current) clearTimeout(subscriptionTimerRef.current)
    }
  }, [])

  const setLayout = useCallback(
    (layout: ChartGridLayout) => {
      setData((prev) => {
        const count = LAYOUT_PANEL_COUNTS[layout] ?? 1
        const panels = ensurePanelCount(prev.panels, count)
        const next = { layout, panels }
        scheduleSave(next)
        updateSubscriptions(panels)
        return next
      })
    },
    [scheduleSave, updateSubscriptions],
  )

  const setPanel = useCallback(
    (index: number, config: Partial<ChartPanelConfig>) => {
      setData((prev) => {
        const panels = prev.panels.map((p, i) => (i === index ? { ...p, ...config } : p))
        const next = { ...prev, panels }
        scheduleSave(next)
        if (config.instrument) updateSubscriptions(panels)
        return next
      })
    },
    [scheduleSave, updateSubscriptions],
  )

  const syncSubscriptions = useCallback(
    (extraInstruments: string[]) => {
      extraInstrumentsRef.current = extraInstruments
      updateSubscriptions(data.panels, extraInstruments)
    },
    [data.panels, updateSubscriptions],
  )

  return {
    layout: data,
    isLoading,
    setLayout,
    setPanel,
    panelCount: LAYOUT_PANEL_COUNTS[data.layout] ?? 1,
    syncSubscriptions,
  }
}
