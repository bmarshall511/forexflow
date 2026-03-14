import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { validateSession, changePin } from "@fxflow/db"

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Require valid session
    const cookieStore = await cookies()
    const token = cookieStore.get("fxflow_session")?.value
    if (!token || !(await validateSession(token))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as { currentPin?: string; newPin?: string }
    const currentPin = body.currentPin?.trim()
    const newPin = body.newPin?.trim()

    if (!currentPin || !newPin) {
      return NextResponse.json(
        { ok: false, error: "Current PIN and new PIN are required" },
        { status: 400 },
      )
    }

    if (newPin.length < 4 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
      return NextResponse.json({ ok: false, error: "New PIN must be 4-8 digits" }, { status: 400 })
    }

    const success = await changePin(currentPin, newPin)
    if (!success) {
      return NextResponse.json({ ok: false, error: "Current PIN is incorrect" }, { status: 401 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST /api/auth/change-pin]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
