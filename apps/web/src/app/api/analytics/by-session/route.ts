import type { NextRequest } from "next/server"
import { getPerformanceBySession } from "@fxflow/db"
import { apiSuccess, apiError } from "@/lib/api-validation"
import { parseAnalyticsFilters } from "../_parse-filters"

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const filters = parseAnalyticsFilters(request.nextUrl.searchParams)
    const data = await getPerformanceBySession(filters)
    return apiSuccess(data)
  } catch (error) {
    console.error("[GET /api/analytics/by-session]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
