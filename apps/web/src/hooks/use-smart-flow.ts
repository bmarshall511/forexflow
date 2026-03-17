"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { SmartFlowTradeData, SmartFlowConfigData, SmartFlowSettingsData } from "@fxflow/types"

export interface UseSmartFlowReturn {
  settings: SmartFlowSettingsData | null
  configs: SmartFlowConfigData[]
  activeTrades: SmartFlowTradeData[]
  closedTrades: SmartFlowTradeData[]
  isLoading: boolean
  refetch: () => void
}

export function useSmartFlow(): UseSmartFlowReturn {
  const [settings, setSettings] = useState<SmartFlowSettingsData | null>(null)
  const [configs, setConfigs] = useState<SmartFlowConfigData[]>([])
  const [activeTrades, setActiveTrades] = useState<SmartFlowTradeData[]>([])
  const [closedTrades, setClosedTrades] = useState<SmartFlowTradeData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const hasFetchedOnce = useRef(false)

  const fetchData = useCallback(async () => {
    if (!hasFetchedOnce.current) setIsLoading(true)
    try {
      const [settingsRes, configsRes, tradesRes, historyRes] = await Promise.all([
        fetch("/api/smart-flow/settings"),
        fetch("/api/smart-flow/configs"),
        fetch("/api/smart-flow/trades"),
        fetch("/api/smart-flow/trades?history=true"),
      ])

      if (settingsRes.ok) {
        const json = (await settingsRes.json()) as { ok: boolean; data?: SmartFlowSettingsData }
        if (json.ok && json.data) setSettings(json.data)
      }
      if (configsRes.ok) {
        const json = (await configsRes.json()) as { ok: boolean; data?: SmartFlowConfigData[] }
        if (json.ok && json.data) setConfigs(json.data)
      }
      if (tradesRes.ok) {
        const json = (await tradesRes.json()) as { ok: boolean; data?: SmartFlowTradeData[] }
        if (json.ok && json.data) setActiveTrades(json.data)
      }
      if (historyRes.ok) {
        const json = (await historyRes.json()) as { ok: boolean; data?: SmartFlowTradeData[] }
        if (json.ok && json.data) setClosedTrades(json.data)
      }
    } catch {
      // API may be unavailable
    } finally {
      setIsLoading(false)
      hasFetchedOnce.current = true
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { settings, configs, activeTrades, closedTrades, isLoading, refetch: fetchData }
}
