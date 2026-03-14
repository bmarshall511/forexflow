import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { deleteSession } from "@fxflow/db"

export async function POST(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("fxflow_session")?.value

    if (token) {
      await deleteSession(token)
    }

    cookieStore.set("fxflow_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST /api/auth/logout]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
