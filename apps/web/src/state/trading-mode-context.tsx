"use client"

import { createContext, useCallback, useEffect, useState, type ReactNode } from "react"
import type { TradingMode, SettingsResponse } from "@fxflow/types"

const DAEMON_REST_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100")
    : ""

export interface TradingModeContextValue {
  /** Current trading mode */
  mode: TradingMode
  /** Whether a mode switch API call is in flight */
  isLoading: boolean
  /** Whether live credentials are configured */
  hasLiveCredentials: boolean
  /** Whether practice credentials are configured */
  hasPracticeCredentials: boolean
  /** Switch trading mode (calls API and persists) */
  setMode: (mode: TradingMode) => Promise<{ ok: boolean; error?: string }>
  /** Update credential status (called by settings page after save/delete) */
  setHasLiveCredentials: (has: boolean) => void
  /** Update credential status (called by settings page after save/delete) */
  setHasPracticeCredentials: (has: boolean) => void
}

export const TradingModeContext = createContext<TradingModeContextValue | null>(null)

interface TradingModeProviderProps {
  children: ReactNode
  initialSettings?: SettingsResponse
}

export function TradingModeProvider({ children, initialSettings }: TradingModeProviderProps) {
  const [mode, setModeState] = useState<TradingMode>(
    initialSettings?.tradingMode ?? "practice",
  )
  const [isLoading, setIsLoading] = useState(false)
  const [hasLiveCredentials, setHasLiveCredentials] = useState(
    initialSettings?.oanda.live.hasToken ?? false,
  )
  const [hasPracticeCredentials, setHasPracticeCredentials] = useState(
    initialSettings?.oanda.practice.hasToken ?? false,
  )

  // Fetch initial state if not provided via server-side props
  useEffect(() => {
    if (initialSettings) return

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: { ok: boolean; data?: SettingsResponse }) => {
        if (data.ok && data.data) {
          setModeState(data.data.tradingMode)
          setHasLiveCredentials(data.data.oanda.live.hasToken)
          setHasPracticeCredentials(data.data.oanda.practice.hasToken)
        }
      })
      .catch(console.error)
  }, [initialSettings])

  const setMode = useCallback(
    async (newMode: TradingMode): Promise<{ ok: boolean; error?: string }> => {
      setIsLoading(true)
      try {
        const res = await fetch("/api/settings/trading-mode", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: newMode }),
        })
        const data = (await res.json()) as { ok: boolean; error?: string }
        if (data.ok) {
          setModeState(newMode)
          // Notify daemon to pick up the mode change immediately
          if (DAEMON_REST_URL) {
            fetch(`${DAEMON_REST_URL}/refresh-credentials`, { method: "POST" }).catch(() => {})
          }
          return { ok: true }
        }
        return { ok: false, error: data.error }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Failed to update mode",
        }
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  return (
    <TradingModeContext.Provider
      value={{
        mode,
        isLoading,
        hasLiveCredentials,
        hasPracticeCredentials,
        setMode,
        setHasLiveCredentials,
        setHasPracticeCredentials,
      }}
    >
      {children}
    </TradingModeContext.Provider>
  )
}
