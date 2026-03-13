"use client"

import { useState, useEffect, useCallback } from "react"
import type { TVAlertsConfig } from "@fxflow/types"

export function useTVAlertsConfig() {
  const [config, setConfig] = useState<TVAlertsConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/tv-alerts/config")
      const json = await res.json()
      if (json.ok) setConfig(json.data)
    } catch (err) {
      console.error("[useTVAlertsConfig] fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchConfig()
  }, [fetchConfig])

  const update = useCallback(async (partial: Partial<TVAlertsConfig>) => {
    const res = await fetch("/api/tv-alerts/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    })
    const json = await res.json()
    if (json.ok) setConfig(json.data)
    else throw new Error(json.error)
  }, [])

  const regenerateToken = useCallback(async (): Promise<string> => {
    const res = await fetch("/api/tv-alerts/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerateToken: true }),
    })
    const json = await res.json()
    if (json.ok) {
      setConfig(json.data)
      return json.data.webhookToken
    }
    throw new Error(json.error)
  }, [])

  const reconnectCF = useCallback(async () => {
    const res = await fetch("/api/tv-alerts/reconnect-cf", { method: "POST" })
    const json = await res.json()
    if (!json.ok) throw new Error(json.error)
  }, [])

  const deployCFWorker = useCallback(async () => {
    const res = await fetch("/api/tv-alerts/deploy-cf-worker", { method: "POST" })
    const json = await res.json()
    if (!json.ok) throw new Error(json.error)
    await fetchConfig()
    return json.data as { workerUrl: string; cfWorkerUrl: string; webhookUrl: string }
  }, [fetchConfig])

  const sendTestSignal = useCallback(async (action: "buy" | "sell", ticker: string) => {
    const res = await fetch("/api/tv-alerts/test-signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ticker }),
    })
    const json = await res.json()
    if (!json.ok) throw new Error(json.error)
    return json.data as {
      cfWorkerResponse: { status: string; instrument?: string; action?: string; reason?: string }
      signalResult: import("@fxflow/types").TVAlertSignal | null
      timedOut?: boolean
    }
  }, [])

  const closeTestTrade = useCallback(async (sourceTradeId: string) => {
    const res = await fetch("/api/tv-alerts/test-signal/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceTradeId }),
    })
    const json = await res.json()
    if (!json.ok) throw new Error(json.error)
  }, [])

  return {
    config, isLoading, update, regenerateToken, reconnectCF,
    deployCFWorker, sendTestSignal, closeTestTrade, refresh: fetchConfig,
  }
}
