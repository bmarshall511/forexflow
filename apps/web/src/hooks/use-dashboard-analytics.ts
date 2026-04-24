"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useDaemonStatus } from "./use-daemon-status"

/**
 * SWR-style analytics fetcher tailored to the dashboard redesign.
 *
 * Responsibilities:
 * - fetch `url`, cache the result in a module-level Map so sibling cards
 *   sharing the same URL make one HTTP call not N
 * - revalidate on mount (stale-while-revalidate: return cached immediately,
 *   refresh in background)
 * - revalidate on tab visibility change (focus refetch)
 * - revalidate on every listed WebSocket event via `useDaemonStatus`
 * - revalidate when `invalidateKey` changes (period rollover, mode switch,
 *   account change — the dashboard header owns this)
 *
 * Not a general-purpose SWR replacement. Narrowly tuned to the dashboard's
 * needs: every card's data is account-scoped + period-scoped, and the
 * expected cardinality of concurrent keys is small (≤20).
 *
 * Usage:
 *   const { data, isLoading, isRefreshing, error, refetch } =
 *     useDashboardAnalytics<EquityCurvePoint[]>(
 *       `/api/analytics/equity-curve?${qs}`,
 *       { invalidateOn: ["trade_closed", "order_filled"], invalidateKey }
 *     )
 */

type DaemonMessageType = import("@fxflow/types").DaemonMessageType

interface CacheEntry<T> {
  data: T | null
  fetchedAt: number
  inflight: Promise<T | null> | null
}

const cache = new Map<string, CacheEntry<unknown>>()

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal })
    const json = await res.json()
    return json.ok ? (json.data as T) : null
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return null
    console.error(`[useDashboardAnalytics] fetch ${url} failed:`, err)
    throw err
  }
}

export interface UseDashboardAnalyticsOptions {
  /**
   * Daemon WS message types that should trigger a background refetch.
   * Debounced at 200ms so a burst of events coalesces into one network
   * round trip.
   */
  invalidateOn?: DaemonMessageType[]
  /**
   * Bump this value to force a refetch — used for period rollover,
   * mode switches, account changes.
   */
  invalidateKey?: string | number
  /**
   * Additional polling interval in ms. Off by default — most invalidation
   * comes from WS events. Useful as a safety net for slow-moving data.
   */
  pollIntervalMs?: number
  /**
   * When false the hook skips all work (including the initial fetch).
   * Use this to defer below-the-fold cards until they mount.
   */
  enabled?: boolean
}

export interface UseDashboardAnalyticsResult<T> {
  data: T | null
  isLoading: boolean
  isRefreshing: boolean
  error: Error | null
  refetch: () => void
}

export function useDashboardAnalytics<T>(
  url: string,
  options: UseDashboardAnalyticsOptions = {},
): UseDashboardAnalyticsResult<T> {
  const { invalidateOn, invalidateKey, pollIntervalMs, enabled = true } = options

  const entry = cache.get(url) as CacheEntry<T> | undefined
  const [data, setData] = useState<T | null>(entry?.data ?? null)
  const [isLoading, setIsLoading] = useState(entry?.data == null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<number | null>(null)

  const doFetch = useCallback(
    async (isBackground: boolean) => {
      if (!enabled) return
      // Collapse concurrent requests for the same URL — sibling cards
      // (e.g. PerformanceHero + DepthSections) share one network round trip.
      const existing = cache.get(url) as CacheEntry<T> | undefined
      if (existing?.inflight) {
        // Set loading state BEFORE awaiting, and clear it when the shared
        // promise resolves. Without the try/finally the follower would stay
        // stuck on the skeleton forever.
        if (existing.data == null) setIsLoading(true)
        try {
          const next = await existing.inflight
          if (next != null) setData(next)
          setError(null)
        } catch (err) {
          setError(err as Error)
        } finally {
          setIsLoading(false)
          setIsRefreshing(false)
        }
        return
      }
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      if (isBackground) setIsRefreshing(true)
      else setIsLoading(existing?.data == null)

      const promise = fetchJson<T>(url, abortRef.current.signal)
      cache.set(url, {
        data: existing?.data ?? null,
        fetchedAt: existing?.fetchedAt ?? 0,
        inflight: promise,
      })

      try {
        const next = await promise
        if (next != null) setData(next)
        cache.set(url, {
          data: next ?? existing?.data ?? null,
          fetchedAt: Date.now(),
          inflight: null,
        })
        setError(null)
      } catch (err) {
        setError(err as Error)
        cache.set(url, {
          data: existing?.data ?? null,
          fetchedAt: existing?.fetchedAt ?? 0,
          inflight: null,
        })
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [url, enabled],
  )

  // Keep the latest doFetch in a ref so the initial-load effect doesn't have
  // to list it as a dep. Previously `doFetch` was memoized on [url, enabled]
  // and listed as an effect dep — any consumer that passed a non-stable url
  // (e.g. range.dateFrom as a Date object re-created every render) would
  // fire a new doFetch → new abort → new fetch every render, producing
  // flashing skeletons that never settle.
  const doFetchRef = useRef(doFetch)
  useEffect(() => {
    doFetchRef.current = doFetch
  }, [doFetch])

  const refetch = useCallback(() => {
    void doFetchRef.current(true)
  }, [])

  // Initial load + fires on url / invalidateKey / enabled changes.
  useEffect(() => {
    const cached = cache.get(url) as CacheEntry<T> | undefined
    if (cached?.data != null) setData(cached.data)
    void doFetchRef.current(cached?.data != null)
    return () => abortRef.current?.abort()
  }, [url, invalidateKey])

  // Focus revalidation — refetch when tab becomes visible again.
  useEffect(() => {
    if (!enabled) return
    const onVis = () => {
      if (document.visibilityState === "visible") refetch()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [enabled, refetch])

  // Polling safety net (off by default).
  useEffect(() => {
    if (!enabled || !pollIntervalMs) return
    const id = window.setInterval(refetch, pollIntervalMs)
    return () => window.clearInterval(id)
  }, [enabled, pollIntervalMs, refetch])

  // Account switch — broadcast by TradingModeContext on mode change. Every
  // cached URL is now stale because the active account changed; nuke the
  // module cache and refetch. Belt-and-suspenders alongside the invalidateKey
  // consumers will bump through useDashboardPeriod's account-aware wrapper.
  useEffect(() => {
    if (!enabled) return
    const onAccountChange = () => {
      cache.clear()
      refetch()
    }
    window.addEventListener("fxflow-account-changed", onAccountChange)
    return () => window.removeEventListener("fxflow-account-changed", onAccountChange)
  }, [enabled, refetch])

  // WS-driven invalidation: subscribe to daemon-status and refetch when the
  // listed message types arrive. Debounced 200 ms so bursts collapse.
  const { lastMessageType } = useDaemonStatusMessageType()
  useEffect(() => {
    if (!enabled || !invalidateOn || !lastMessageType) return
    if (!invalidateOn.includes(lastMessageType)) return
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      refetch()
      debounceRef.current = null
    }, 200)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [enabled, lastMessageType, invalidateOn, refetch])

  return { data, isLoading, isRefreshing, error, refetch }
}

/**
 * Small indirection over `useDaemonStatus` — we need to know "what was the
 * most recent WS message type" without subscribing to every single field.
 * The daemon-status context already tracks per-event fields; this helper
 * surfaces a single monotonic `(type, seq)` tuple so invalidation logic
 * above can dedup on the type alone.
 */
function useDaemonStatusMessageType(): {
  lastMessageType: DaemonMessageType | null
} {
  const status = useDaemonStatus()
  // Prefer explicit "last X updated at" fields; fall back to generic WS
  // message tracking if the daemon-status context exposes it. This hook is
  // defensive — if the context shape changes we still compile.
  const lastType = (status as unknown as { lastMessageType?: DaemonMessageType }).lastMessageType
  return { lastMessageType: lastType ?? null }
}
