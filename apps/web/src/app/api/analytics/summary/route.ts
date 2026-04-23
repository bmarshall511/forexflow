import type { NextRequest } from "next/server"
import { getPerformanceSummary } from "@fxflow/db"
import type { PerformanceSummary, ApiResponse } from "@fxflow/types"
import { apiSuccess, apiError } from "@/lib/api-validation"
import { parseAnalyticsFilters } from "../_parse-filters"

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const filters = await parseAnalyticsFilters(request.nextUrl.searchParams)
    const data: PerformanceSummary = await getPerformanceSummary(filters)
    return apiSuccess<ApiResponse<PerformanceSummary>["data"]>(data)
  } catch (error) {
    console.error("[GET /api/analytics/summary]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
