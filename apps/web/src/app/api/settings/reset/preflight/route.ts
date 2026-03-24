import { getResetPreflightStatus } from "@fxflow/db"
import { apiSuccess, apiError } from "@/lib/api-validation"
import { getServerDaemonUrl } from "@/lib/daemon-url"

export const dynamic = "force-dynamic"

const DAEMON_URL = getServerDaemonUrl()

export async function GET() {
  try {
    const status = await getResetPreflightStatus()

    // Also check daemon's live OANDA state — the DB may be empty after a previous
    // reset but OANDA can still have active orders/trades that need to be closed.
    try {
      const daemonRes = await fetch(`${DAEMON_URL}/status`, { cache: "no-store" })
      if (daemonRes.ok) {
        const json = (await daemonRes.json()) as {
          ok: boolean
          data?: {
            oanda?: { openTradeCount?: number; pendingOrderCount?: number }
          }
        }
        if (json.ok && json.data?.oanda) {
          // Use the higher of DB count vs OANDA live count
          status.openTrades = Math.max(status.openTrades, json.data.oanda.openTradeCount ?? 0)
          status.pendingOrders = Math.max(
            status.pendingOrders,
            json.data.oanda.pendingOrderCount ?? 0,
          )
        }
      }
    } catch {
      // Daemon may be offline — use DB counts only
    }

    return apiSuccess(status)
  } catch (error) {
    console.error("[GET /api/settings/reset/preflight]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
