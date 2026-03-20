"use client"

import { useState, useEffect, useCallback } from "react"
import type { TradeFinderConfigData, TradeFinderCircuitBreakerState } from "@fxflow/types"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

export function useTradeFinderConfig() {
  const [config, setConfig] = useState<TradeFinderConfigData | null>(null)
  const [circuitBreaker, setCircuitBreaker] = useState<TradeFinderCircuitBreakerState | null>(null)
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

  const fetchCircuitBreaker = useCallback(async () => {
    try {
      const res = await fetch(`${DAEMON_URL}/trade-finder/circuit-breaker`)
      const json = await res.json()
      if (json.ok) setCircuitBreaker(json.data)
    } catch {
      // Non-critical — daemon may not be running
    }
  }, [])

  useEffect(() => {
    void fetchConfig()
    void fetchCircuitBreaker()
  }, [fetchConfig, fetchCircuitBreaker])

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

  const resetCircuitBreaker = useCallback(async () => {
    await fetch(`${DAEMON_URL}/actions/trade-finder/reset-circuit-breaker`, { method: "POST" })
    await fetchCircuitBreaker()
  }, [fetchCircuitBreaker])

  return { config, circuitBreaker, isLoading, update, refresh: fetchConfig, resetCircuitBreaker }
}
