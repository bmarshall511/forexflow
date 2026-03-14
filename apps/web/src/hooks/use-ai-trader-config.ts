"use client"

import { useState, useEffect, useCallback } from "react"
import type { AiTraderConfigData } from "@fxflow/types"

export interface UseAiTraderConfigReturn {
  config: AiTraderConfigData | null
  isLoading: boolean
  error: string | null
  save: (data: Partial<AiTraderConfigData>) => Promise<void>
  refetch: () => void
}

export function useAiTraderConfig(): UseAiTraderConfigReturn {
  const [config, setConfig] = useState<AiTraderConfigData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchKey, setFetchKey] = useState(0)

  const refetch = useCallback(() => setFetchKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetch("/api/ai-trader/config")
      .then((res) => res.json())
      .then((json: { ok: boolean; data?: AiTraderConfigData; error?: string }) => {
        if (cancelled) return
        if (!json.ok || !json.data) {
          setError(json.error ?? "Failed to load AI Trader config")
          setConfig(null)
          return
        }
        setConfig(json.data)
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
          setConfig(null)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [fetchKey])

  // Listen for cross-instance config changes (e.g. header toggle → settings page)
  useEffect(() => {
    const handler = () => refetch()
    window.addEventListener("ai-trader-config-changed", handler)
    return () => window.removeEventListener("ai-trader-config-changed", handler)
  }, [refetch])

  const save = useCallback(async (data: Partial<AiTraderConfigData>): Promise<void> => {
    const res = await fetch("/api/ai-trader/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = (await res.json()) as { ok: boolean; data?: AiTraderConfigData; error?: string }
    if (!json.ok) throw new Error(json.error ?? "Failed to save AI Trader config")
    if (json.data) setConfig(json.data)
    window.dispatchEvent(new Event("ai-trader-config-changed"))
  }, [])

  return { config, isLoading, error, save, refetch }
}
