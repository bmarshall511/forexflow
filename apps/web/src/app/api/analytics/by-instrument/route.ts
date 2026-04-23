import type { NextRequest } from "next/server"
import { getPerformanceByInstrument } from "@fxflow/db"
import { apiSuccess, apiError } from "@/lib/api-validation"
import { parseAnalyticsFilters } from "../_parse-filters"

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const filters = await parseAnalyticsFilters(request.nextUrl.searchParams)
    const data = await getPerformanceByInstrument(filters)
    return apiSuccess(data)
  } catch (error) {
    console.error("[GET /api/analytics/by-instrument]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
