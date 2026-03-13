"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import type { TradeActionResponse, PlaceOrderRequest, PlaceOrderResponseData } from "@fxflow/types"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

export interface BulkActionResult {
  succeeded: number
  failed: number
  errors: string[]
}

export interface UseTradeActionsReturn {
  cancelOrder: (sourceOrderId: string, reason?: string) => Promise<boolean>
  cancelAllOrders: (sourceOrderIds?: string[], reason?: string) => Promise<BulkActionResult>
  closeTrade: (sourceTradeId: string, units?: number, reason?: string) => Promise<boolean>
  closeAllTrades: (sourceTradeIds?: string[], reason?: string) => Promise<BulkActionResult>
  modifyTrade: (
    sourceTradeId: string,
    opts: { stopLoss?: number | null; takeProfit?: number | null },
  ) => Promise<boolean>
  modifyPendingOrder: (
    sourceOrderId: string,
    opts: { stopLoss?: number | null; takeProfit?: number | null; entryPrice?: number; gtdTime?: string | null },
  ) => Promise<boolean>
  placeOrder: (request: PlaceOrderRequest) => Promise<PlaceOrderResponseData | null>
  refreshPositions: () => Promise<void>
  isLoading: boolean
}

export function useTradeActions(): UseTradeActionsReturn {
  const [isLoading, setIsLoading] = useState(false)

  const callDaemon = useCallback(
    async (path: string, body: unknown): Promise<boolean> => {
      setIsLoading(true)
      try {
        const res = await fetch(`${DAEMON_URL}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = (await res.json()) as TradeActionResponse
        if (!json.ok) {
          toast.error(json.error ?? "Action failed")
          return false
        }
        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Network error")
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const cancelOrder = useCallback(
    async (sourceOrderId: string, reason?: string): Promise<boolean> => {
      const ok = await callDaemon("/actions/cancel-order", { sourceOrderId, reason })
      if (ok) toast.success("Order cancelled")
      return ok
    },
    [callDaemon],
  )

  const cancelAllOrders = useCallback(
    async (sourceOrderIds?: string[], reason?: string): Promise<BulkActionResult> => {
      setIsLoading(true)
      try {
        const res = await fetch(`${DAEMON_URL}/actions/cancel-all-orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceOrderIds, reason }),
        })
        const json = (await res.json()) as TradeActionResponse<BulkActionResult>
        if (!json.ok) {
          toast.error(json.error ?? "Cancel all failed")
          return { succeeded: 0, failed: 0, errors: [] }
        }
        const result = json.data!
        if (result.failed === 0) {
          toast.success(`${result.succeeded} ${result.succeeded === 1 ? "order" : "orders"} cancelled`)
        } else {
          toast.warning(`${result.succeeded} cancelled, ${result.failed} failed`)
        }
        return result
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Network error")
        return { succeeded: 0, failed: 0, errors: [] }
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const closeTrade = useCallback(
    async (sourceTradeId: string, units?: number, reason?: string): Promise<boolean> => {
      const ok = await callDaemon("/actions/close-trade", { sourceTradeId, units, reason })
      if (ok) toast.success(units ? "Partial close submitted" : "Trade closed")
      return ok
    },
    [callDaemon],
  )

  const closeAllTrades = useCallback(
    async (sourceTradeIds?: string[], reason?: string): Promise<BulkActionResult> => {
      setIsLoading(true)
      try {
        const res = await fetch(`${DAEMON_URL}/actions/close-all-trades`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceTradeIds, reason }),
        })
        const json = (await res.json()) as TradeActionResponse<BulkActionResult>
        if (!json.ok) {
          toast.error(json.error ?? "Close all failed")
          return { succeeded: 0, failed: 0, errors: [] }
        }
        const result = json.data!
        if (result.failed === 0) {
          toast.success(`${result.succeeded} ${result.succeeded === 1 ? "trade" : "trades"} closed`)
        } else {
          toast.warning(`${result.succeeded} closed, ${result.failed} failed`)
        }
        return result
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Network error")
        return { succeeded: 0, failed: 0, errors: [] }
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const refreshPositions = useCallback(
    async (): Promise<void> => {
      try {
        await fetch(`${DAEMON_URL}/actions/refresh-positions`, { method: "POST" })
      } catch { /* best-effort */ }
    },
    [],
  )

  const modifyTrade = useCallback(
    async (
      sourceTradeId: string,
      opts: { stopLoss?: number | null; takeProfit?: number | null },
    ): Promise<boolean> => {
      const ok = await callDaemon("/actions/modify-trade", {
        sourceTradeId,
        ...opts,
      })
      if (ok) {
        toast.success("SL/TP verified and updated in OANDA")
        // Force immediate daemon re-sync so positions tables update without waiting for next reconcile
        void fetch(`${DAEMON_URL}/actions/refresh-positions`, { method: "POST" }).catch(() => {})
      }
      return ok
    },
    [callDaemon],
  )

  const modifyPendingOrder = useCallback(
    async (
      sourceOrderId: string,
      opts: { stopLoss?: number | null; takeProfit?: number | null; entryPrice?: number; gtdTime?: string | null },
    ): Promise<boolean> => {
      const ok = await callDaemon("/actions/modify-pending-order", {
        sourceOrderId,
        ...opts,
      })
      if (ok) {
        const parts: string[] = []
        if (opts.stopLoss !== undefined || opts.takeProfit !== undefined) parts.push("SL/TP")
        if (opts.entryPrice !== undefined) parts.push("entry price")
        if (opts.gtdTime !== undefined) parts.push("expiry")
        toast.success(`Order ${parts.join(", ")} updated in OANDA`)
        void fetch(`${DAEMON_URL}/actions/refresh-positions`, { method: "POST" }).catch(() => {})
      }
      return ok
    },
    [callDaemon],
  )

  const placeOrder = useCallback(
    async (request: PlaceOrderRequest): Promise<PlaceOrderResponseData | null> => {
      setIsLoading(true)
      try {
        const res = await fetch(`${DAEMON_URL}/actions/place-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        })
        const json = (await res.json()) as TradeActionResponse<PlaceOrderResponseData>
        if (!json.ok) {
          toast.error(json.error ?? "Order failed")
          return null
        }
        const data = json.data!
        if (data.filled) {
          toast.success(`Market order filled @ ${data.fillPrice}`)
        } else {
          toast.success("Limit order placed")
        }
        return data
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Network error")
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  return { cancelOrder, cancelAllOrders, closeTrade, closeAllTrades, modifyTrade, modifyPendingOrder, placeOrder, refreshPositions, isLoading }
}
