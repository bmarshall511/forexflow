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
  const { isConnected, connectionAttempted, oanda, accountOverview } = useDaemonStatus()

  // Daemon is unreachable: connection was attempted but failed and we have no data
  const isDaemonDown = connectionAttempted && !isConnected && oanda === null

  // Health check has run and reported an error (not just "hasn't loaded yet")
  const hasError =
    isDaemonDown ||
    (oanda !== null &&
      oanda.status !== "unconfigured" &&
      oanda.lastHealthCheck !== null &&
      !oanda.accountValid)

  return {
    data: accountOverview,
    isLoaded: accountOverview !== null,
    isAccountValid: oanda?.accountValid ?? false,
    isConfigured: isDaemonDown || oanda?.status !== "unconfigured",
    hasError,
    errorMessage: isDaemonDown
      ? "Daemon is not running. Start it with `pnpm dev` or check for errors."
      : (oanda?.errorMessage ?? null),
    tradingMode: oanda?.tradingMode ?? "practice",
  }
}
