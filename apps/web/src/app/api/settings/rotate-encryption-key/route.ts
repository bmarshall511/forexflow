import { NextResponse } from "next/server"
import { rotateEncryptionKeys } from "@fxflow/db"
import type { ApiResponse } from "@fxflow/types"

interface RotationResult {
  reEncrypted: number
  errors: string[]
}

export async function POST(): Promise<NextResponse<ApiResponse<RotationResult>>> {
  try {
    const result = await rotateEncryptionKeys()

    if (result.errors.length > 0) {
      console.warn(
        `[POST /api/settings/rotate-encryption-key] Completed with ${result.errors.length} error(s):`,
        result.errors,
      )
    }

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    console.error("[POST /api/settings/rotate-encryption-key]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
