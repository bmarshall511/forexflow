import { NextResponse } from "next/server"
import { getChartLayout, saveChartLayout } from "@fxflow/db"
import type { ChartLayoutData } from "@fxflow/types"

export async function GET() {
  try {
    const data = await getChartLayout()
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    console.error("[api/chart-layout] GET error:", err)
    return NextResponse.json({ ok: false, error: "Failed to load chart layout" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as ChartLayoutData
    await saveChartLayout(body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[api/chart-layout] PUT error:", err)
    return NextResponse.json({ ok: false, error: "Failed to save chart layout" }, { status: 500 })
  }
}
