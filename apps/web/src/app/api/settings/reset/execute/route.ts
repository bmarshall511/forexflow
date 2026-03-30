import { z } from "zod"
import {
  resetModule,
  resetTradingData,
  resetFactory,
  disableAllAutomation,
  setLastResetAt,
  type ResetModule,
  type ResetResult,
} from "@fxflow/db"
import { parseBody, apiSuccess, apiError } from "@/lib/api-validation"
import { getServerDaemonUrl } from "@/lib/daemon-url"

const DAEMON_URL = getServerDaemonUrl()

/**
 * Close all open trades and cancel all pending orders on OANDA before DB reset.
 * Returns an array of warning messages for any operations that failed.
 * Without this, OANDA orders survive the DB reset and get re-created as "OANDA" source
 * on the next reconcile cycle — losing source attribution permanently.
 */
async function closeAllOandaPositions(): Promise<string[]> {
  const warnings: string[] = []

  // Cancel all pending orders (omit sourceOrderIds to cancel ALL)
  try {
    const res = await fetch(`${DAEMON_URL}/actions/cancel-all-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Trading data reset" }),
    })
    if (!res.ok) {
      warnings.push(`Cancel orders: daemon returned ${res.status}`)
    }
  } catch (err) {
    warnings.push(`Cancel orders: ${err instanceof Error ? err.message : "daemon unreachable"}`)
  }

  // Close all open trades (omit sourceTradeIds to close ALL)
  try {
    const res = await fetch(`${DAEMON_URL}/actions/close-all-trades`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Trading data reset" }),
    })
    if (!res.ok) {
      warnings.push(`Close trades: daemon returned ${res.status}`)
    }
  } catch (err) {
    warnings.push(`Close trades: ${err instanceof Error ? err.message : "daemon unreachable"}`)
  }

  // Cancel AI conditions
  try {
    const res = await fetch(`${DAEMON_URL}/actions/ai/cancel-all-conditions`, { method: "POST" })
    if (!res.ok) {
      warnings.push(`Cancel AI conditions: daemon returned ${res.status}`)
    }
  } catch (err) {
    warnings.push(
      `Cancel AI conditions: ${err instanceof Error ? err.message : "daemon unreachable"}`,
    )
  }

  return warnings
}

/** Notify daemon to re-sync in-memory state after DB resets (best-effort). */
async function notifyDaemonAfterReset(modules: ResetModule[]): Promise<void> {
  const promises: Promise<unknown>[] = []
  if (modules.includes("tv_alerts")) {
    promises.push(
      fetch(`${DAEMON_URL}/actions/tv-alerts/reset-signal-history`, { method: "POST" }).catch(
        () => {},
      ),
    )
  }
  if (
    modules.includes("trading_history") ||
    modules.includes("trade_finder") ||
    modules.includes("ai_trader")
  ) {
    promises.push(
      fetch(`${DAEMON_URL}/actions/refresh-positions`, { method: "POST" }).catch(() => {}),
    )
  }
  await Promise.all(promises)
}

const VALID_MODULES: ResetModule[] = [
  "trading_history",
  "tv_alerts",
  "ai_analysis",
  "ai_trader",
  "trade_finder",
  "technical_data",
  "notifications",
  "chart_state",
]

const ExecuteResetSchema = z.object({
  level: z.enum(["selective", "trading_data", "factory"]),
  modules: z.array(z.enum(VALID_MODULES as [ResetModule, ...ResetModule[]])).optional(),
})

export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, ExecuteResetSchema)
    if (!parsed.success) return parsed.response

    const { level, modules } = parsed.data
    const oandaWarnings: string[] = []

    if (level === "selective") {
      if (!modules || modules.length === 0) {
        return apiError("At least one module is required for selective reset")
      }

      const includesTrading = modules.includes("trading_history")

      // Server-side: disable automation before clearing data to prevent
      // auto-trade systems from immediately re-placing trades after reset
      if (includesTrading) {
        await disableAllAutomation()
        oandaWarnings.push(...(await closeAllOandaPositions()))
        await setLastResetAt()
      }

      const errors: string[] = []
      const modulesReset: ResetModule[] = []
      let recordsDeleted = 0

      for (const mod of modules) {
        try {
          const { deleted } = await resetModule(mod)
          modulesReset.push(mod)
          recordsDeleted += deleted
        } catch (err) {
          errors.push(`${mod}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      const result: ResetResult & { oandaWarnings?: string[] } = {
        success: errors.length === 0,
        modulesReset,
        recordsDeleted,
        errors,
        ...(oandaWarnings.length > 0 && { oandaWarnings }),
      }
      // Notify daemon to re-sync in-memory state for reset modules
      await notifyDaemonAfterReset(modulesReset)
      return apiSuccess(result)
    }

    // Both trading_data and factory: disable automation + close OANDA + set reset timestamp
    await disableAllAutomation()
    oandaWarnings.push(...(await closeAllOandaPositions()))
    await setLastResetAt()

    const allModules: ResetModule[] = ["trading_history", "tv_alerts", "trade_finder", "ai_trader"]

    if (level === "trading_data") {
      const result = await resetTradingData()
      await notifyDaemonAfterReset(allModules)
      return apiSuccess({
        ...result,
        ...(oandaWarnings.length > 0 && { oandaWarnings }),
      })
    }

    // factory
    const result = await resetFactory()
    await notifyDaemonAfterReset(allModules)
    return apiSuccess({
      ...result,
      ...(oandaWarnings.length > 0 && { oandaWarnings }),
    })
  } catch (error) {
    console.error("[POST /api/settings/reset/execute]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
