"use client"

import { useState, useEffect, useCallback } from "react"
import type { PriceAlertData } from "@fxflow/types"
import { useDaemonConnection } from "./use-daemon-connection"

export function usePriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlertData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { lastPriceAlertTriggered } = useDaemonConnection()

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts")
      const json = (await res.json()) as { ok: boolean; data?: PriceAlertData[] }
      if (json.ok && json.data) setAlerts(json.data)
    } catch (err) {
      console.error("[usePriceAlerts] fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAlerts()
  }, [fetchAlerts])

  // Auto-refetch when an alert triggers via WS
  useEffect(() => {
    if (lastPriceAlertTriggered) void fetchAlerts()
  }, [lastPriceAlertTriggered, fetchAlerts])

  const createAlert = useCallback(
    async (data: {
      instrument: string
      direction: "above" | "below"
      targetPrice: number
      currentPrice: number
      label?: string
      repeating?: boolean
      expiresAt?: string
    }) => {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!json.ok) throw new Error(json.error ?? "Failed to create alert")
      void fetchAlerts()
    },
    [fetchAlerts],
  )

  const updateAlert = useCallback(
    async (
      id: string,
      data: {
        label?: string
        targetPrice?: number
        direction?: "above" | "below"
        expiresAt?: string | null
      },
    ) => {
      const res = await fetch(`/api/alerts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!json.ok) throw new Error(json.error ?? "Failed to update alert")
      void fetchAlerts()
    },
    [fetchAlerts],
  )

  const deleteAlert = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!json.ok) throw new Error(json.error ?? "Failed to delete alert")
      void fetchAlerts()
    },
    [fetchAlerts],
  )

  const cancelAll = useCallback(async () => {
    const res = await fetch("/api/alerts", { method: "DELETE" })
    const json = (await res.json()) as { ok: boolean; error?: string }
    if (!json.ok) throw new Error(json.error ?? "Failed to cancel alerts")
    void fetchAlerts()
  }, [fetchAlerts])

  return {
    alerts,
    isLoading,
    createAlert,
    updateAlert,
    deleteAlert,
    cancelAll,
    refresh: fetchAlerts,
  }
}
