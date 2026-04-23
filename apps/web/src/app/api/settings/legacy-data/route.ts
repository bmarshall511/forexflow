/**
 * Legacy data endpoints — inspect and wipe rows that predate the Phase -1
 * account-isolation migration (account = "unknown").
 *
 * GET    — returns the current counts across every trade-derived table.
 * DELETE — deletes every unknown-account row inside a single transaction.
 *
 * These rows are excluded from analytics automatically (every list/summary
 * query filters by the active account), so leaving them in place is safe —
 * DELETE is only for users who want a clean baseline with no "unknown"
 * badges showing anywhere.
 */
import { NextResponse } from "next/server"
import {
  getLegacyDataCounts,
  clearLegacyData,
  type LegacyDataCounts,
  type ClearLegacyDataResult,
} from "@fxflow/db"
import type { ApiResponse } from "@fxflow/types"

export async function GET(): Promise<NextResponse<ApiResponse<LegacyDataCounts>>> {
  try {
    const data = await getLegacyDataCounts()
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error("[GET /api/settings/legacy-data]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function DELETE(): Promise<NextResponse<ApiResponse<ClearLegacyDataResult>>> {
  try {
    const data = await clearLegacyData()
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error("[DELETE /api/settings/legacy-data]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
