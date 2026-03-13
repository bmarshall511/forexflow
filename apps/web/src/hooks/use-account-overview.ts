"use client"

import { useDaemonStatus } from "./use-daemon-status"
import type { AccountOverviewData, TradingMode } from "@fxflow/types"

export interface AccountOverviewState {
  /** Raw data from daemon (null = not loaded yet) */
  data: AccountOverviewData | null
  /** Whether account overview data has been received */
  isLoaded: boolean
  /** Whether the OANDA connection is established and valid */
  isAccountValid: boolean
  /** Whether credentials are configured */
  isConfigured: boolean
  /** Whether a connection error has been reported (health check ran but failed) */
  hasError: boolean
  /** Error message from OANDA health check */
  errorMessage: string | null
  /** Current trading mode (practice or live) */
  tradingMode: TradingMode
}

export function useAccountOverview(): AccountOverviewState {
  const { oanda, accountOverview } = useDaemonStatus()

  // Health check has run and reported an error (not just "hasn't loaded yet")
  const hasError = oanda !== null
    && oanda.status !== "unconfigured"
    && oanda.lastHealthCheck !== null
    && !oanda.accountValid

  return {
    data: accountOverview,
    isLoaded: accountOverview !== null,
    isAccountValid: oanda?.accountValid ?? false,
    isConfigured: oanda?.status !== "unconfigured",
    hasError,
    errorMessage: oanda?.errorMessage ?? null,
    tradingMode: oanda?.tradingMode ?? "practice",
  }
}
