import { NextResponse } from "next/server"
import { cookies, headers } from "next/headers"
import { verifyPin, createSession, getSessionExpiry } from "@fxflow/db"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Rate limit: 5 attempts per minute per IP
    const headerStore = await headers()
    const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const { allowed, retryAfterMs } = checkRateLimit(`auth:login:${ip}`, 5, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
        },
      )
    }

    const body = (await request.json()) as { pin?: string }
    const pin = body.pin?.trim()

    if (!pin) {
      return NextResponse.json({ ok: false, error: "PIN is required" }, { status: 400 })
    }

    const result = await verifyPin(pin)

    if (result.locked) {
      return NextResponse.json(
        {
          ok: false,
          error: "Too many failed attempts",
          data: {
            locked: true,
            lockoutRemainingMs: result.lockoutRemainingMs,
          },
        },
        { status: 429 },
      )
    }

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Incorrect PIN",
          data: {
            locked: false,
            attemptsRemaining: result.attemptsRemaining,
          },
        },
        { status: 401 },
      )
    }

    // Create session
    const device = headerStore.get("user-agent") ?? undefined
    const token = await createSession(device)
    const expirySeconds = await getSessionExpiry()

    const cookieStore = await cookies()
    cookieStore.set("fxflow_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expirySeconds,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST /api/auth/login]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
