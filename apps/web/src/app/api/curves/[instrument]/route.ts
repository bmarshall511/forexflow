import { NextResponse, type NextRequest } from "next/server"
import { upsertCurveSnapshot, getCurveSnapshot } from "@fxflow/db"
import type { CurveData } from "@fxflow/types"

interface RouteParams {
  params: Promise<{ instrument: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { instrument } = await params
    const timeframe = request.nextUrl.searchParams.get("timeframe") ?? "H1"

    const snapshot = await getCurveSnapshot(instrument, timeframe)
    if (!snapshot) {
      return NextResponse.json({ ok: true, data: null })
    }

    return NextResponse.json({ ok: true, data: snapshot })
  } catch (error) {
    console.error("[GET /api/curves/[instrument]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { instrument } = await params
    const body = (await request.json()) as CurveData

    await upsertCurveSnapshot(instrument, body)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST /api/curves/[instrument]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
