"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { SetupCheckId, SetupCheckItem, SetupStatusResponse } from "@fxflow/types"

/**
 * Dashboard "Setup Needed" hook — fetches `/api/settings/setup-status` and
 * filters out items the user has dismissed on this device.
 *
 * Dismissals are persisted under `fxflow:dismissed-setup-items` as a
 * JSON-encoded `SetupCheckId[]`. Stable IDs (not titles) keep dismissals
 * durable across copy changes.
 *
 * Re-fetches:
 * - On mount
 * - On `fxflow-account-changed` (different account has different setup needs)
 * - On tab visibility change
 * - Every 60s as a safety net (settings writes from other tabs aren't
 *   broadcast, so we don't want to go stale forever)
 */
const STORAGE_KEY = "fxflow:dismissed-setup-items"

function readDismissed(): Set<SetupCheckId> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as SetupCheckId[]
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function writeDismissed(set: Set<SetupCheckId>): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}

export interface UseSetupStatusResult {
  /** Items after dismissal filter, in severity order (error → warning → info). */
  items: SetupCheckItem[]
  /** Full item count including dismissed ones — useful for a "N hidden" affordance. */
  totalIncludingDismissed: number
  isLoading: boolean
  error: Error | null
  /** Hide an item on this device. Non-dismissible items ignore this call. */
  dismiss: (id: SetupCheckId) => void
  /** Clear all dismissals so every check is visible again. */
  resetDismissed: () => void
  refetch: () => void
}

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const

export function useSetupStatus(): UseSetupStatusResult {
  const [data, setData] = useState<SetupStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [dismissed, setDismissed] = useState<Set<SetupCheckId>>(() => readDismissed())

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/setup-status")
      const json = (await res.json()) as { ok: boolean; data?: SetupStatusResponse; error?: string }
      if (json.ok && json.data) {
        setData(json.data)
        setError(null)
      } else if (!json.ok) {
        throw new Error(json.error ?? "Failed to fetch setup status")
      }
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  // Visibility-driven revalidation.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refetch()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [refetch])

  // Account switch invalidates — different account has different setup gaps.
  useEffect(() => {
    const onAccountChange = () => void refetch()
    window.addEventListener("fxflow-account-changed", onAccountChange)
    return () => window.removeEventListener("fxflow-account-changed", onAccountChange)
  }, [refetch])

  // Safety-net polling (slow — settings changes are infrequent).
  useEffect(() => {
    const id = window.setInterval(() => void refetch(), 60_000)
    return () => window.clearInterval(id)
  }, [refetch])

  const dismiss = useCallback((id: SetupCheckId) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      writeDismissed(next)
      return next
    })
  }, [])

  const resetDismissed = useCallback(() => {
    setDismissed(new Set())
    writeDismissed(new Set())
  }, [])

  const { items, totalIncludingDismissed } = useMemo(() => {
    const raw = data?.items ?? []
    const visible = raw.filter((it) => !(it.dismissible && dismissed.has(it.id)))
    visible.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    return { items: visible, totalIncludingDismissed: raw.length }
  }, [data, dismissed])

  return {
    items,
    totalIncludingDismissed,
    isLoading,
    error,
    dismiss,
    resetDismissed,
    refetch,
  }
}
