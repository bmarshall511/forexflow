import { type NextRequest } from "next/server"
import { getUpcomingEvents } from "@fxflow/db"
import type { EconomicEventData } from "@fxflow/types"
import { apiSuccess, apiError } from "@/lib/api-validation"

/**
 * GET /api/calendar/upcoming
 *
 * Returns upcoming economic calendar events (next 48h by default).
 * Query params: hours (number), impact ("low"|"medium"|"high"), currency (string).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const hoursParam = searchParams.get("hours")
    const impact = searchParams.get("impact") ?? undefined
    const currency = searchParams.get("currency") ?? undefined

    const hours = hoursParam ? Math.min(Math.max(Number(hoursParam), 1), 168) : 48

    if (impact && !["low", "medium", "high"].includes(impact)) {
      return apiError("impact must be 'low', 'medium', or 'high'", 400)
    }

    const events: EconomicEventData[] = await getUpcomingEvents({ hours, impact, currency })
    return apiSuccess(events)
  } catch (error) {
    console.error("[GET /api/calendar/upcoming]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
