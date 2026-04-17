"use client"

import { useState, useEffect } from "react"
import type {
  SmartFlowTradeData,
  SmartFlowConfigData,
  SmartFlowOpportunityData,
} from "@fxflow/types"

export interface SmartFlowTradeContext {
  trade: SmartFlowTradeData
  config: SmartFlowConfigData | null
  opportunity: SmartFlowOpportunityData | null
}

export interface UseSmartFlowTradeReturn {
  context: SmartFlowTradeContext | null
  isSmartFlowTrade: boolean
  isLoading: boolean
}

/**
 * Fetch SmartFlow context for a trade (if it's a SmartFlow trade).
 * Pass the trade's DB id and enriched source to determine if it should query.
 */
export function useSmartFlowTrade(
  tradeId: string | null,
  source: string | undefined | null,
): UseSmartFlowTradeReturn {
  const [context, setContext] = useState<SmartFlowTradeContext | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isSmartFlow = source === "smart_flow"

  useEffect(() => {
    if (!tradeId || !isSmartFlow) {
      setContext(null)
      return
    }

    let cancelled = false
    setIsLoading(true)

    fetch(`/api/smart-flow/trades/${tradeId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        if (json.ok && json.data) {
          setContext(json.data as SmartFlowTradeContext)
        }
      })
      .catch(() => {
        if (!cancelled) setContext(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tradeId, isSmartFlow])

  return { context, isSmartFlowTrade: isSmartFlow, isLoading }
}
