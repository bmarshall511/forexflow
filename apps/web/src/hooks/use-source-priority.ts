"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import type { SourcePriorityConfigData, SourcePriorityLogEntry } from "@fxflow/types"

export interface UseSourcePriorityReturn {
  config: SourcePriorityConfigData | null
  logs: SourcePriorityLogEntry[]
  isLoading: boolean
  updateConfig: (updates: Partial<SourcePriorityConfigData>) => Promise<boolean>
  refreshLogs: () => void
}

export function useSourcePriority(): UseSourcePriorityReturn {
  const [config, setConfig] = useState<SourcePriorityConfigData | null>(null)
  const [logs, setLogs] = useState<SourcePriorityLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const hasFetchedOnce = useRef(false)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/source-priority")
      if (!res.ok) return
      const json = (await res.json()) as {
        ok: boolean
        data?: SourcePriorityConfigData
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
        data?: SourcePriorityLogEntry[]
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

  const updateConfig = useCallback(
    async (updates: Partial<SourcePriorityConfigData>): Promise<boolean> => {
      try {
        const res = await fetch("/api/source-priority", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
        const json = (await res.json()) as {
          ok: boolean
          data?: SourcePriorityConfigData
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

  return { config, logs, isLoading, updateConfig, refreshLogs }
}
