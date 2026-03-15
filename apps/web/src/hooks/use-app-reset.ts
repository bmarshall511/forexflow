"use client"

import { useState, useCallback } from "react"
import type { PreflightStatus, ResetModule, ResetResult } from "@fxflow/db"

interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

export interface UseAppResetReturn {
  preflight: PreflightStatus | null
  isLoadingPreflight: boolean
  preflightError: string | null
  fetchPreflight: () => Promise<PreflightStatus | null>
  isExecuting: boolean
  executeError: string | null
  executeReset: (
    level: "selective" | "trading_data" | "factory",
    modules?: ResetModule[],
  ) => Promise<ResetResult | null>
  executeFreshInstall: () => Promise<boolean>
}

export function useAppReset(): UseAppResetReturn {
  const [preflight, setPreflight] = useState<PreflightStatus | null>(null)
  const [isLoadingPreflight, setIsLoadingPreflight] = useState(false)
  const [preflightError, setPreflightError] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executeError, setExecuteError] = useState<string | null>(null)

  const fetchPreflight = useCallback(async (): Promise<PreflightStatus | null> => {
    setIsLoadingPreflight(true)
    setPreflightError(null)
    try {
      const res = await fetch("/api/settings/reset/preflight", { cache: "no-store" })
      const json = (await res.json()) as ApiResponse<PreflightStatus>
      if (!json.ok || !json.data) {
        setPreflightError(json.error ?? "Failed to fetch preflight status")
        return null
      }
      setPreflight(json.data)
      return json.data
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error"
      setPreflightError(msg)
      return null
    } finally {
      setIsLoadingPreflight(false)
    }
  }, [])

  const executeReset = useCallback(
    async (
      level: "selective" | "trading_data" | "factory",
      modules?: ResetModule[],
    ): Promise<ResetResult | null> => {
      setIsExecuting(true)
      setExecuteError(null)
      try {
        const res = await fetch("/api/settings/reset/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level, modules }),
        })
        const json = (await res.json()) as ApiResponse<ResetResult>
        if (!json.ok || !json.data) {
          setExecuteError(json.error ?? "Reset failed")
          return null
        }
        return json.data
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error"
        setExecuteError(msg)
        return null
      } finally {
        setIsExecuting(false)
      }
    },
    [],
  )

  const executeFreshInstall = useCallback(async (): Promise<boolean> => {
    setIsExecuting(true)
    setExecuteError(null)
    try {
      const res = await fetch("/api/settings/reset/fresh-install", { method: "POST" })
      const json = (await res.json()) as ApiResponse<{ deleted: boolean }>
      if (!json.ok) {
        setExecuteError(json.error ?? "Fresh install failed")
        return false
      }
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error"
      setExecuteError(msg)
      return false
    } finally {
      setIsExecuting(false)
    }
  }, [])

  return {
    preflight,
    isLoadingPreflight,
    preflightError,
    fetchPreflight,
    isExecuting,
    executeError,
    executeReset,
    executeFreshInstall,
  }
}
