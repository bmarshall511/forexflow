import { NextResponse } from "next/server"
import { cookies, headers } from "next/headers"
import { hasPin, createPin, createSession } from "@fxflow/db"

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const pinExists = await hasPin()
    if (pinExists) {
      return NextResponse.json({ ok: false, error: "PIN already configured" }, { status: 400 })
    }

    const body = (await request.json()) as { pin?: string }
    const pin = body.pin?.trim()

    if (!pin || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
      return NextResponse.json({ ok: false, error: "PIN must be 4-8 digits" }, { status: 400 })
    }

    await createPin(pin)

    // Auto-login after setup
    const headerStore = await headers()
    const device = headerStore.get("user-agent") ?? undefined
    const token = await createSession(device)

    const cookieStore = await cookies()
    cookieStore.set("fxflow_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400, // 24h default
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST /api/auth/setup]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
