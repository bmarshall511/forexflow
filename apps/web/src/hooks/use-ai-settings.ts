"use client"

import { useState, useEffect, useCallback } from "react"
import type {
  AiSettingsData,
  AiAutoAnalysisSettings,
  AiClaudeModel,
  AiAnalysisDepth,
} from "@fxflow/types"

export interface UseAiSettingsReturn {
  settings: AiSettingsData | null
  isLoading: boolean
  saveClaudeKey: (key: string) => Promise<void>
  removeClaudeKey: () => Promise<void>
  saveFinnhubKey: (key: string) => Promise<void>
  removeFinnhubKey: () => Promise<void>
  savePreferences: (
    prefs: Partial<AiAutoAnalysisSettings> & {
      defaultModel?: AiClaudeModel
      defaultDepth?: AiAnalysisDepth
      liveAutoApplyEnabled?: boolean
    },
  ) => Promise<void>
  refetch: () => void
}

export function useAiSettings(): UseAiSettingsReturn {
  const [settings, setSettings] = useState<AiSettingsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [fetchKey, setFetchKey] = useState(0)

  const refetch = useCallback(() => setFetchKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    fetch("/api/ai/settings")
      .then((res) => res.json())
      .then((json: { ok: boolean; data?: AiSettingsData }) => {
        if (cancelled || !json.ok || !json.data) return
        setSettings(json.data)
      })
      .catch(() => {
        if (!cancelled) setSettings(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [fetchKey])

  const put = useCallback(async (body: Record<string, unknown>): Promise<void> => {
    const res = await fetch("/api/ai/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = (await res.json()) as { ok: boolean; data?: AiSettingsData; error?: string }
    if (!json.ok) throw new Error(json.error ?? "Failed to save")
    if (json.data) setSettings(json.data)
  }, [])

  return {
    settings,
    isLoading,
    saveClaudeKey: (key) => put({ claudeApiKey: key }),
    removeClaudeKey: () => put({ claudeApiKey: null }),
    saveFinnhubKey: (key) => put({ finnhubApiKey: key }),
    removeFinnhubKey: () => put({ finnhubApiKey: null }),
    savePreferences: (prefs) => put({ preferences: prefs }),
    refetch,
  }
}
