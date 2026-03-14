import { deleteDatabaseFile } from "@fxflow/db"
import { apiSuccess, apiError } from "@/lib/api-validation"

export async function POST() {
  try {
    const deleted = await deleteDatabaseFile()
    return apiSuccess({ deleted })
  } catch (error) {
    console.error("[POST /api/settings/reset/fresh-install]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
