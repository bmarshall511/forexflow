import { NextResponse } from "next/server"
import { getOnboardingCompleted, setOnboardingCompleted } from "@fxflow/db"
import type { ApiResponse } from "@fxflow/types"

export async function GET(): Promise<NextResponse<ApiResponse<{ completed: boolean }>>> {
  try {
    const completed = await getOnboardingCompleted()
    return NextResponse.json({ ok: true, data: { completed } })
  } catch (error) {
    console.error("[GET /api/settings/onboarding]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function PUT(): Promise<NextResponse<ApiResponse<{ completed: boolean }>>> {
  try {
    await setOnboardingCompleted()
    return NextResponse.json({ ok: true, data: { completed: true } })
  } catch (error) {
    console.error("[PUT /api/settings/onboarding]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
