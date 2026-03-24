"use client"

import { useState, useEffect, useCallback } from "react"
import type { TVAlertsQualityConfig } from "@fxflow/types"

export function useTVAlertsQualityConfig() {
  const [config, setConfig] = useState<TVAlertsQualityConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/tv-alerts/quality-config")
      const json = await res.json()
      if (json.ok) setConfig(json.data)
    } catch (err) {
      console.error("[useTVAlertsQualityConfig] fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchConfig()
  }, [fetchConfig])

  const update = useCallback(async (partial: Partial<TVAlertsQualityConfig>) => {
    const res = await fetch("/api/tv-alerts/quality-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    })
    const json = await res.json()
    if (json.ok) setConfig(json.data)
    else throw new Error(json.error)
  }, [])

  return {
    config,
    isLoading,
    update,
    refresh: fetchConfig,
  }
}
