"use client"

import { useState, useEffect, useCallback } from "react"
import type { EconomicEventData } from "@fxflow/types"

const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const COUNTDOWN_TICK_MS = 60 * 1000 // 1 minute

export interface UseCalendarReturn {
  events: EconomicEventData[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useCalendar(hours = 48): UseCalendarReturn {
  const [events, setEvents] = useState<EconomicEventData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchKey, setFetchKey] = useState(0)

  // Force re-render for countdown updates
  const [, setTick] = useState(0)

  const refetch = useCallback(() => setFetchKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    fetch(`/api/calendar/upcoming?hours=${hours}`)
      .then(async (res) => {
        const json = (await res.json()) as {
          ok: boolean
          data?: EconomicEventData[]
          error?: string
        }
        if (cancelled) return
        if (json.ok && json.data) {
          setEvents(json.data)
          setError(null)
        } else {
          setError(json.error ?? "Failed to fetch calendar")
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [hours, fetchKey])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(refetch, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refetch])

  // Tick every minute to update countdowns in the UI
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), COUNTDOWN_TICK_MS)
    return () => clearInterval(interval)
  }, [])

  // Refetch when page becomes visible (user returns to tab)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refetch()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [refetch])

  return { events, isLoading, error, refetch }
}
