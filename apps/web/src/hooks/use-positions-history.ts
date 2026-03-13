"use client"

import { useState, useEffect, useCallback } from "react"
import type {
  ClosedTradeData,
  TradeDirection,
  TradeOutcome,
} from "@fxflow/types"
import { useDaemonStatus } from "./use-daemon-status"

export interface TradeHistoryFilters {
  instrument?: string
  direction?: TradeDirection
  outcome?: TradeOutcome
  from?: string // ISO date string
  to?: string // ISO date string
  tagIds?: string[]
  sort?: string
  order?: "asc" | "desc"
}

export interface UsePositionsHistoryReturn {
  trades: ClosedTradeData[]
  isLoading: boolean
  totalCount: number
  page: number
  pageSize: number
  setPage: (page: number) => void
  filters: TradeHistoryFilters
  setFilters: (filters: TradeHistoryFilters) => void
  refetch: () => void
}

const PAGE_SIZE = 20

export function usePositionsHistory(): UsePositionsHistoryReturn {
  const [trades, setTrades] = useState<ClosedTradeData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<TradeHistoryFilters>({})
  const [fetchKey, setFetchKey] = useState(0)
  const { positions } = useDaemonStatus()

  const refetch = useCallback(() => setFetchKey((k) => k + 1), [])

  // Refetch when new closed trades arrive (positions update with new closed count)
  const closedCount = positions?.closed?.length ?? 0
  useEffect(() => {
    if (closedCount > 0) refetch()
  }, [closedCount, refetch])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const params = new URLSearchParams()
    params.set("status", "closed")
    params.set("page", String(page))
    params.set("limit", String(PAGE_SIZE))

    if (filters.instrument) params.set("instrument", filters.instrument)
    if (filters.direction) params.set("direction", filters.direction)
    if (filters.outcome) params.set("outcome", filters.outcome)
    if (filters.from) params.set("from", filters.from)
    if (filters.to) params.set("to", filters.to)
    if (filters.tagIds?.length) params.set("tags", filters.tagIds.join(","))
    if (filters.sort) params.set("sort", filters.sort)
    if (filters.order) params.set("order", filters.order)

    fetch(`/api/trades?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.ok && json.data) {
          setTrades(json.data.trades)
          setTotalCount(json.data.totalCount)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTrades([])
          setTotalCount(0)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [page, filters, fetchKey])

  return {
    trades,
    isLoading,
    totalCount,
    page,
    pageSize: PAGE_SIZE,
    setPage,
    filters,
    setFilters,
    refetch,
  }
}
