import { getSourceBreakdown, getSettings } from "@fxflow/db"
import { apiSuccess, apiError } from "@/lib/api-validation"

export async function GET(): Promise<Response> {
  try {
    const settings = await getSettings()
    const data = await getSourceBreakdown({ account: settings.tradingMode })
    return apiSuccess(data)
  } catch (error) {
    console.error("[GET /api/analytics/source-breakdown]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
