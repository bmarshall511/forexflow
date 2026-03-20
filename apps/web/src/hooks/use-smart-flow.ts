"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type {
  SmartFlowTradeData,
  SmartFlowConfigData,
  SmartFlowSettingsData,
  SmartFlowStatusData,
} from "@fxflow/types"

export interface UseSmartFlowReturn {
  settings: SmartFlowSettingsData | null
  configs: SmartFlowConfigData[]
  activeTrades: SmartFlowTradeData[]
  closedTrades: SmartFlowTradeData[]
  status: SmartFlowStatusData | null
  isLoading: boolean
  refetch: () => void
}

export function useSmartFlow(): UseSmartFlowReturn {
  const [settings, setSettings] = useState<SmartFlowSettingsData | null>(null)
  const [configs, setConfigs] = useState<SmartFlowConfigData[]>([])
  const [activeTrades, setActiveTrades] = useState<SmartFlowTradeData[]>([])
  const [closedTrades, setClosedTrades] = useState<SmartFlowTradeData[]>([])
  const [status, setStatus] = useState<SmartFlowStatusData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const hasFetchedOnce = useRef(false)

  const fetchData = useCallback(async () => {
    if (!hasFetchedOnce.current) setIsLoading(true)
    try {
      const [settingsRes, configsRes, tradesRes, historyRes, statusRes] = await Promise.all([
        fetch("/api/smart-flow/settings"),
        fetch("/api/smart-flow/configs"),
        fetch("/api/smart-flow/trades"),
        fetch("/api/smart-flow/trades?history=true"),
        fetch("/api/daemon/smart-flow/status"),
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
      if (statusRes.ok) {
        const json = (await statusRes.json()) as { ok: boolean; data?: SmartFlowStatusData }
        if (json.ok && json.data) setStatus(json.data)
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

  // Listen for cross-component updates (e.g., reset preflight disabling SmartFlow)
  useEffect(() => {
    const handler = () => void fetchData()
    window.addEventListener("smart-flow-updated", handler)
    return () => window.removeEventListener("smart-flow-updated", handler)
  }, [fetchData])

  return { settings, configs, activeTrades, closedTrades, status, isLoading, refetch: fetchData }
}
