import { getSourceBreakdown } from "@fxflow/db"
import { apiSuccess, apiError } from "@/lib/api-validation"

export async function GET(): Promise<Response> {
  try {
    const data = await getSourceBreakdown()
    return apiSuccess(data)
  } catch (error) {
    console.error("[GET /api/analytics/source-breakdown]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
