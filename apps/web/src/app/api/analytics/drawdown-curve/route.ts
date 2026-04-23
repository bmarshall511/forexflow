import type { NextRequest } from "next/server"
import { getDrawdownCurve } from "@fxflow/db"
import { apiSuccess, apiError } from "@/lib/api-validation"
import { parseAnalyticsFilters } from "../_parse-filters"

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const filters = await parseAnalyticsFilters(request.nextUrl.searchParams)
    const startingBalanceParam = request.nextUrl.searchParams.get("startingBalance")
    const startingBalance = startingBalanceParam ? Number(startingBalanceParam) : undefined
    const data = await getDrawdownCurve(
      filters,
      Number.isFinite(startingBalance) ? startingBalance : undefined,
    )
    return apiSuccess(data)
  } catch (error) {
    console.error("[GET /api/analytics/drawdown-curve]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
