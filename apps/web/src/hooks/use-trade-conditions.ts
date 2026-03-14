"use client"

import { useState, useEffect, useCallback } from "react"
import type {
  TradeConditionData,
  TradeConditionTriggerType,
  TradeConditionActionType,
} from "@fxflow/types"

export interface CreateConditionInput {
  triggerType: TradeConditionTriggerType
  triggerValue: Record<string, unknown>
  actionType: TradeConditionActionType
  actionParams?: Record<string, unknown>
  label?: string
  priority?: number
  expiresAt?: string
  analysisId?: string
  parentConditionId?: string
  status?: "active" | "waiting"
}

export interface UseTradeConditionsReturn {
  conditions: TradeConditionData[]
  isLoading: boolean
  createCondition: (input: CreateConditionInput) => Promise<TradeConditionData | null>
  deleteCondition: (conditionId: string) => Promise<void>
  refetch: () => void
}

export function useTradeConditions(tradeId: string | null): UseTradeConditionsReturn {
  const [conditions, setConditions] = useState<TradeConditionData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [fetchKey, setFetchKey] = useState(0)

  const refetch = useCallback(() => setFetchKey((k) => k + 1), [])

  useEffect(() => {
    if (!tradeId) {
      setConditions([])
      return
    }

    let cancelled = false
    setIsLoading(true)

    fetch(`/api/ai/conditions/${tradeId}`)
      .then((res) => res.json())
      .then((json: { ok: boolean; data?: TradeConditionData[] }) => {
        if (cancelled || !json.ok || !json.data) return
        setConditions(json.data)
      })
      .catch(() => {
        if (!cancelled) setConditions([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tradeId, fetchKey])

  const createCondition = useCallback(
    async (input: CreateConditionInput): Promise<TradeConditionData | null> => {
      if (!tradeId) return null
      const res = await fetch(`/api/ai/conditions/${tradeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const json = (await res.json()) as { ok: boolean; data?: TradeConditionData; error?: string }
      if (!json.ok || !json.data) throw new Error(json.error ?? "Failed to create condition")
      setConditions((prev) => [json.data!, ...prev])
      return json.data
    },
    [tradeId],
  )

  const deleteCondition = useCallback(
    async (conditionId: string): Promise<void> => {
      if (!tradeId) return

      // Capture previous state for rollback on failure
      const previousConditions = [...conditions]
      setConditions((prev) => prev.filter((c) => c.id !== conditionId))

      try {
        const res = await fetch(`/api/ai/conditions/${tradeId}/${conditionId}`, {
          method: "DELETE",
        })
        const json = (await res.json()) as { ok: boolean; error?: string }
        if (!json.ok) throw new Error(json.error ?? "Delete failed")
      } catch (err) {
        // Rollback on failure
        setConditions(previousConditions)
        throw err
      }
    },
    [tradeId, conditions],
  )

  return { conditions, isLoading, createCondition, deleteCondition, refetch }
}
