"use client"

import { useState, useEffect, useCallback } from "react"
import type { TradeFinderConfigData } from "@fxflow/types"

export function useTradeFinderConfig() {
  const [config, setConfig] = useState<TradeFinderConfigData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/trade-finder/config")
      const json = await res.json()
      if (json.ok) setConfig(json.data)
    } catch (err) {
      console.error("[useTradeFinderConfig] fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchConfig()
  }, [fetchConfig])

  // Listen for cross-instance config changes (e.g. header toggle → settings page)
  useEffect(() => {
    const handler = () => void fetchConfig()
    window.addEventListener("trade-finder-config-changed", handler)
    return () => window.removeEventListener("trade-finder-config-changed", handler)
  }, [fetchConfig])

  const update = useCallback(async (partial: Partial<TradeFinderConfigData>) => {
    const res = await fetch("/api/trade-finder/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    })
    const json = await res.json()
    if (json.ok) setConfig(json.data)
    else throw new Error(json.error)
    window.dispatchEvent(new Event("trade-finder-config-changed"))
  }, [])

  return { config, isLoading, update, refresh: fetchConfig }
}
