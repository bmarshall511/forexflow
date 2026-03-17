"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"

// ─── Types ─────────────────────────────────────────────────────────
// TODO: Move to @fxflow/types once SmartFlow types are finalized

export interface SmartFlowConfigDetail {
  id: string
  name: string
  instrument: string
  direction: "long" | "short"
  isActive: boolean
  entryZoneHigh: number
  entryZoneLow: number
  stopLoss: number
  takeProfit: number
  riskPercent: number
  trailingStop: boolean
  trailingStopDistance: number | null
  breakEvenTrigger: number | null
  partialTakeProfit: boolean
  partialTakeProfitPercent: number | null
  partialTakeProfitLevel: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface SmartFlowConfigInput {
  name: string
  instrument: string
  direction: "long" | "short"
  entryZoneHigh: number
  entryZoneLow: number
  stopLoss: number
  takeProfit: number
  riskPercent: number
  trailingStop?: boolean
  trailingStopDistance?: number | null
  breakEvenTrigger?: number | null
  partialTakeProfit?: boolean
  partialTakeProfitPercent?: number | null
  partialTakeProfitLevel?: number | null
  notes?: string | null
}

export interface UseSmartFlowConfigReturn {
  config: SmartFlowConfigDetail | null
  isLoading: boolean
  error: string | null
  createConfig: (input: SmartFlowConfigInput) => Promise<SmartFlowConfigDetail | null>
  updateConfig: (id: string, fields: Partial<SmartFlowConfigInput>) => Promise<boolean>
  deleteConfig: (id: string) => Promise<boolean>
  activateConfig: (id: string) => Promise<boolean>
  deactivateConfig: (id: string) => Promise<boolean>
}

export function useSmartFlowConfig(configId?: string): UseSmartFlowConfigReturn {
  const [config, setConfig] = useState<SmartFlowConfigDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── Fetch single config by ID ──────────────────────────────────

  useEffect(() => {
    if (!configId) return
    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetch(`/api/smart-flow/configs/${configId}`)
      .then((res) => res.json())
      .then((json: { ok: boolean; data?: SmartFlowConfigDetail; error?: string }) => {
        if (cancelled) return
        if (!json.ok || !json.data) {
          setError(json.error ?? "Failed to load config")
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
  }, [configId])

  // ─── CRUD Actions ───────────────────────────────────────────────

  const createConfig = useCallback(
    async (input: SmartFlowConfigInput): Promise<SmartFlowConfigDetail | null> => {
      try {
        const res = await fetch("/api/smart-flow/configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
        const json = (await res.json()) as {
          ok: boolean
          data?: SmartFlowConfigDetail
          error?: string
        }
        if (!json.ok || !json.data) {
          toast.error(json.error ?? "Failed to create config")
          return null
        }
        toast.success("Config created")
        window.dispatchEvent(new Event("smart-flow-updated"))
        return json.data
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Network error")
        return null
      }
    },
    [],
  )

  const updateConfig = useCallback(
    async (id: string, fields: Partial<SmartFlowConfigInput>): Promise<boolean> => {
      try {
        const res = await fetch(`/api/smart-flow/configs/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        })
        const json = (await res.json()) as {
          ok: boolean
          data?: SmartFlowConfigDetail
          error?: string
        }
        if (!json.ok) {
          toast.error(json.error ?? "Failed to update config")
          return false
        }
        if (json.data) setConfig(json.data)
        toast.success("Config updated")
        window.dispatchEvent(new Event("smart-flow-updated"))
        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Network error")
        return false
      }
    },
    [],
  )

  const deleteConfig = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/smart-flow/configs/${id}`, {
        method: "DELETE",
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!json.ok) {
        toast.error(json.error ?? "Failed to delete config")
        return false
      }
      toast.success("Config deleted")
      setConfig(null)
      window.dispatchEvent(new Event("smart-flow-updated"))
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error")
      return false
    }
  }, [])

  const activateConfig = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/smart-flow/configs/${id}/activate`, {
        method: "POST",
      })
      const json = (await res.json()) as {
        ok: boolean
        data?: SmartFlowConfigDetail
        error?: string
      }
      if (!json.ok) {
        toast.error(json.error ?? "Failed to activate config")
        return false
      }
      if (json.data) setConfig(json.data)
      toast.success("Config activated")
      window.dispatchEvent(new Event("smart-flow-updated"))
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error")
      return false
    }
  }, [])

  const deactivateConfig = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/smart-flow/configs/${id}/deactivate`, {
        method: "POST",
      })
      const json = (await res.json()) as {
        ok: boolean
        data?: SmartFlowConfigDetail
        error?: string
      }
      if (!json.ok) {
        toast.error(json.error ?? "Failed to deactivate config")
        return false
      }
      if (json.data) setConfig(json.data)
      toast.success("Config deactivated")
      window.dispatchEvent(new Event("smart-flow-updated"))
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error")
      return false
    }
  }, [])

  return {
    config,
    isLoading,
    error,
    createConfig,
    updateConfig,
    deleteConfig,
    activateConfig,
    deactivateConfig,
  }
}
