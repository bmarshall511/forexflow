import { getResetPreflightStatus } from "@fxflow/db"
import { apiSuccess, apiError } from "@/lib/api-validation"

export async function GET() {
  try {
    const status = await getResetPreflightStatus()
    return apiSuccess(status)
  } catch (error) {
    console.error("[GET /api/settings/reset/preflight]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
