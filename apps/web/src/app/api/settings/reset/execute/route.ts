import { z } from "zod"
import {
  resetModule,
  resetTradingData,
  resetFactory,
  type ResetModule,
  type ResetResult,
} from "@fxflow/db"
import { parseBody, apiSuccess, apiError } from "@/lib/api-validation"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

/**
 * Close all open trades and cancel all pending orders on OANDA before DB reset.
 * Without this, OANDA orders survive the DB reset and get re-created as "OANDA" source
 * on the next reconcile cycle — losing source attribution permanently.
 */
async function closeAllOandaPositions(): Promise<void> {
  try {
    // Cancel all pending orders (omit sourceOrderIds to cancel ALL)
    await fetch(`${DAEMON_URL}/actions/cancel-all-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Trading data reset" }),
    }).catch(() => {})

    // Close all open trades (omit sourceTradeIds to close ALL)
    await fetch(`${DAEMON_URL}/actions/close-all-trades`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Trading data reset" }),
    }).catch(() => {})

    // Cancel AI conditions
    await fetch(`${DAEMON_URL}/actions/ai/cancel-all-conditions`, { method: "POST" }).catch(
      () => {},
    )
  } catch {
    // Best-effort — don't block the reset
  }
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

    if (level === "selective") {
      if (!modules || modules.length === 0) {
        return apiError("At least one module is required for selective reset")
      }

      // Close OANDA positions before clearing trading history to prevent orphaned orders
      if (modules.includes("trading_history")) {
        await closeAllOandaPositions()
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

      const result: ResetResult = {
        success: errors.length === 0,
        modulesReset,
        recordsDeleted,
        errors,
      }
      // Notify daemon to re-sync in-memory state for reset modules
      await notifyDaemonAfterReset(modulesReset)
      return apiSuccess(result)
    }

    if (level === "trading_data") {
      await closeAllOandaPositions()
      const result = await resetTradingData()
      await notifyDaemonAfterReset(["trading_history", "tv_alerts", "trade_finder", "ai_trader"])
      return apiSuccess(result)
    }

    // factory
    await closeAllOandaPositions()
    const result = await resetFactory()
    await notifyDaemonAfterReset(["trading_history", "tv_alerts", "trade_finder", "ai_trader"])
    return apiSuccess(result)
  } catch (error) {
    console.error("[POST /api/settings/reset/execute]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
