"use client"

import { useState, useEffect, useCallback } from "react"
import type { TVAlertsManagementConfig } from "@fxflow/types"

export function useTVAlertsManagementConfig() {
  const [config, setConfig] = useState<TVAlertsManagementConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/tv-alerts/management-config")
      const json = await res.json()
      if (json.ok) setConfig(json.data)
    } catch (err) {
      console.error("[useTVAlertsManagementConfig] fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchConfig()
  }, [fetchConfig])

  const update = useCallback(async (partial: Partial<TVAlertsManagementConfig>) => {
    const res = await fetch("/api/tv-alerts/management-config", {
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
