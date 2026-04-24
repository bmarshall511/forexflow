"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  resolveDashboardPeriod,
  msUntilNextBoundary,
  type DashboardPeriod,
  type DashboardPeriodMode,
  type DashboardPeriodRange,
} from "@fxflow/shared"

/**
 * Dashboard period state — period selection (today/week/month/year/allTime)
 * plus the boundary mode (local calendar day vs. forex 5 PM ET anchors).
 *
 * - `period` is URL-synced via `?period=` so links are shareable and a
 *   refresh keeps the user's view.
 * - `mode` lives in `localStorage` under `fxflow:dashboard-period-mode` —
 *   it's a personal preference, not something to share in URLs. Defaults
 *   to `"local"` per the user's spec.
 * - A rollover timer fires when the current period boundary crosses
 *   (local midnight / Monday / 1st of month / Jan 1) so consumers that
 *   memoize on `range` refetch automatically. Consumers that want finer
 *   invalidation can subscribe to `range` via useEffect.
 *
 * All five periods are exposed as strings; `"allTime"` has no rollover.
 */
const STORAGE_KEY = "fxflow:dashboard-period-mode"
const PERIODS: readonly DashboardPeriod[] = [
  "today",
  "thisWeek",
  "thisMonth",
  "thisYear",
  "allTime",
] as const
const MODES: readonly DashboardPeriodMode[] = ["local", "forex"] as const

function parsePeriod(raw: string | null): DashboardPeriod {
  if (raw && (PERIODS as readonly string[]).includes(raw)) return raw as DashboardPeriod
  return "thisMonth"
}

function parseMode(raw: string | null): DashboardPeriodMode {
  if (raw && (MODES as readonly string[]).includes(raw)) return raw as DashboardPeriodMode
  return "local"
}

export interface UseDashboardPeriodResult {
  period: DashboardPeriod
  mode: DashboardPeriodMode
  range: DashboardPeriodRange
  /** Monotonic counter that bumps on each period rollover so downstream hooks can revalidate. */
  rolloverKey: number
  setPeriod: (period: DashboardPeriod) => void
  setMode: (mode: DashboardPeriodMode) => void
}

export function useDashboardPeriod(): UseDashboardPeriodResult {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlPeriod = parsePeriod(searchParams.get("period"))

  const [period, setPeriodState] = useState<DashboardPeriod>(urlPeriod)
  const [mode, setModeState] = useState<DashboardPeriodMode>(() => {
    if (typeof window === "undefined") return "local"
    return parseMode(window.localStorage.getItem(STORAGE_KEY))
  })
  const [rolloverKey, setRolloverKey] = useState(0)
  // `now` anchors the resolved range to the current tick; we bump it on
  // rollover so `range` is a fresh object and useEffect deps update.
  const [now, setNow] = useState(() => new Date())

  // Keep local state in sync with URL edits (back/forward, deep links).
  useEffect(() => {
    setPeriodState(urlPeriod)
  }, [urlPeriod])

  const setPeriod = useCallback(
    (next: DashboardPeriod) => {
      setPeriodState(next)
      const params = new URLSearchParams(searchParams.toString())
      if (next === "thisMonth") params.delete("period")
      else params.set("period", next)
      const query = params.toString()
      router.replace(query ? `?${query}` : window.location.pathname, { scroll: false })
    },
    [router, searchParams],
  )

  const setMode = useCallback((next: DashboardPeriodMode) => {
    setModeState(next)
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  // Schedule a rollover timer for the current (period, mode).
  useEffect(() => {
    const ms = msUntilNextBoundary(period, mode, now)
    if (ms === null) return // allTime never rolls over
    // Add a small grace margin so the new boundary is comfortably past by the
    // time we recompute (avoids edge cases where the fire-time math lands 1ms
    // before the real boundary due to clock drift).
    const id = window.setTimeout(() => {
      setNow(new Date())
      setRolloverKey((k) => k + 1)
    }, ms + 500)
    return () => window.clearTimeout(id)
  }, [period, mode, now])

  // MUST be memoized on (period, mode, now). resolveDashboardPeriod builds
  // brand-new Date instances every call; without useMemo, consumers that
  // pass `range.dateFrom` into their own useMemo deps would see a "changed"
  // reference on every render, causing URL rebuild → fetch abort/retry
  // loops that never settle (i.e. the flashing skeleton bug).
  const range = useMemo<DashboardPeriodRange>(
    () => resolveDashboardPeriod(period, mode, now),
    [period, mode, now],
  )

  return { period, mode, range, rolloverKey, setPeriod, setMode }
}
