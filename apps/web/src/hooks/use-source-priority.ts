"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"

// ─── Types ─────────────────────────────────────────────────────────
// TODO: Move to @fxflow/types once source priority types are finalized

export interface SourcePriorityConfig {
  enabled: boolean
  priorities: SourcePriorityEntry[]
  conflictResolution: "highest_priority" | "most_recent" | "manual"
  cooldownMinutes: number
}

export interface SourcePriorityEntry {
  source: string
  priority: number
  enabled: boolean
  label: string
}

export interface SourcePriorityLog {
  id: string
  timestamp: string
  instrument: string
  winningSource: string
  losingSource: string
  reason: string
  action: "blocked" | "overridden" | "queued"
}

export interface UseSourcePriorityReturn {
  config: SourcePriorityConfig | null
  logs: SourcePriorityLog[]
  isLoading: boolean
  updateConfig: (updates: Partial<SourcePriorityConfig>) => Promise<boolean>
  refreshLogs: () => void
}

export function useSourcePriority(): UseSourcePriorityReturn {
  const [config, setConfig] = useState<SourcePriorityConfig | null>(null)
  const [logs, setLogs] = useState<SourcePriorityLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const hasFetchedOnce = useRef(false)

  // ─── Fetch config + logs ────────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/source-priority")
      if (!res.ok) return
      const json = (await res.json()) as {
        ok: boolean
        data?: SourcePriorityConfig
        error?: string
      }
      if (json.ok && json.data) setConfig(json.data)
    } catch {
      // API may not be ready yet
    }
  }, [])

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/source-priority/logs")
      if (!res.ok) return
      const json = (await res.json()) as {
        ok: boolean
        data?: SourcePriorityLog[]
        error?: string
      }
      if (json.ok && json.data) setLogs(json.data)
    } catch {
      // API may not be ready yet
    }
  }, [])

  const fetchAll = useCallback(async () => {
    if (!hasFetchedOnce.current) setIsLoading(true)
    await Promise.all([fetchConfig(), fetchLogs()])
    setIsLoading(false)
    hasFetchedOnce.current = true
  }, [fetchConfig, fetchLogs])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  // ─── Actions ────────────────────────────────────────────────────

  const updateConfig = useCallback(
    async (updates: Partial<SourcePriorityConfig>): Promise<boolean> => {
      try {
        const res = await fetch("/api/source-priority", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
        const json = (await res.json()) as {
          ok: boolean
          data?: SourcePriorityConfig
          error?: string
        }
        if (!json.ok) {
          toast.error(json.error ?? "Failed to update source priority config")
          return false
        }
        if (json.data) setConfig(json.data)
        toast.success("Source priority config updated")
        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Network error")
        return false
      }
    },
    [],
  )

  const refreshLogs = useCallback(() => {
    void fetchLogs()
  }, [fetchLogs])

  return {
    config,
    logs,
    isLoading,
    updateConfig,
    refreshLogs,
  }
}
