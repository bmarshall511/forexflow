import type { NextRequest } from "next/server"
import { getMfeMaeDistribution } from "@fxflow/db"
import { apiSuccess, apiError } from "@/lib/api-validation"
import { parseAnalyticsFilters } from "../_parse-filters"

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const filters = parseAnalyticsFilters(request.nextUrl.searchParams)
    const data = await getMfeMaeDistribution(filters)
    return apiSuccess(data)
  } catch (error) {
    console.error("[GET /api/analytics/edge]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
