"use client"

import { useCallback, useEffect, useState } from "react"
import { useDaemonStatus } from "@/hooks/use-daemon-status"

export interface DaemonHealth {
  uptimeSeconds: number
  startedAt: string
  memory: { rss: number; heapUsed: number; heapTotal: number; external: number }
  wsClients: number
  oanda: Record<string, unknown>
  market: Record<string, unknown>
  tradingMode: string
  tvAlerts: { enabled: boolean; cfWorkerConnected: boolean } | null
  tradeFinder: { enabled: boolean; scanStatus: Record<string, unknown> | null }
  aiTrader: { enabled: boolean }
}

export interface StorageStats {
  trades: number
  signals: number
  analyses: number
  conditions: number
  setups: number
  opportunities: number
  notifications: number
  zones: number
  total: number
}

export interface SystemHealthData {
  daemon: DaemonHealth | null
  daemonReachable: boolean
  storage: StorageStats | null
}

const REFRESH_INTERVAL = 30_000

export function useSystemHealth() {
  const { isConnected, oanda, snapshot } = useDaemonStatus()
  const [health, setHealth] = useState<SystemHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/system/health")
      if (res.ok) {
        const json = (await res.json()) as { ok: boolean; data: SystemHealthData }
        if (json.ok) {
          setHealth(json.data)
          setLastRefresh(new Date())
        }
      }
    } catch {
      // Silently handle — daemonReachable will be false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchHealth()
    const timer = setInterval(() => void fetchHealth(), REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [fetchHealth])

  return { health, loading, lastRefresh, refetch: fetchHealth, isConnected, oanda, snapshot }
}
