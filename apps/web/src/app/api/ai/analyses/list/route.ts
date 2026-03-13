import { NextRequest, NextResponse } from "next/server"
import { getAnalysesPaginated } from "@fxflow/db"
import type { AiAnalysisTriggeredBy } from "@fxflow/types"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const p = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10) || 1)
  const pageSize = Math.min(Math.max(parseInt(p.get("pageSize") ?? "20", 10) || 20, 1), 100)
  const triggeredBy = p.get("triggeredBy") as AiAnalysisTriggeredBy | null
  const status = p.get("status") ?? undefined

  try {
    const data = await getAnalysesPaginated({
      page,
      pageSize,
      triggeredBy: triggeredBy ?? undefined,
      status,
    })
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
