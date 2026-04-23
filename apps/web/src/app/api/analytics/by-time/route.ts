import type { NextRequest } from "next/server"
import { getPerformanceByDayOfWeek, getPerformanceByHourOfDay } from "@fxflow/db"
import { apiSuccess, apiError } from "@/lib/api-validation"
import { parseAnalyticsFilters } from "../_parse-filters"

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const filters = await parseAnalyticsFilters(request.nextUrl.searchParams)
    const [byDayOfWeek, byHourOfDay] = await Promise.all([
      getPerformanceByDayOfWeek(filters),
      getPerformanceByHourOfDay(filters),
    ])
    return apiSuccess({ byDayOfWeek, byHourOfDay })
  } catch (error) {
    console.error("[GET /api/analytics/by-time]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
