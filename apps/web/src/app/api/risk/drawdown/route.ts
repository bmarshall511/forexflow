import { NextResponse } from "next/server"
import { listTrades } from "@fxflow/db"
import type { ApiResponse } from "@fxflow/types"

export interface DrawdownData {
  /** Current drawdown from peak as a percentage (0-100) */
  currentDrawdown: number
  /** Maximum historical drawdown as a percentage (0-100) */
  maxDrawdown: number
  /** Peak cumulative equity (realized P&L) */
  peakEquity: number
  /** Current cumulative equity (realized P&L) */
  currentEquity: number
  /** Days since peak equity was reached */
  drawdownDuration: number
  /** Currency amount of current drawdown */
  currentDrawdownAmount: number
  /** Currency amount of max drawdown */
  maxDrawdownAmount: number
}

export async function GET(): Promise<NextResponse<ApiResponse<DrawdownData>>> {
  try {
    const result = await listTrades({
      status: "closed",
      sort: "closedAt",
      order: "asc",
      limit: 10_000,
      offset: 0,
    })

    let cumulativePL = 0
    let peakEquity = 0
    let maxDrawdownAmount = 0
    let peakDate: Date | null = null

    for (const trade of result.trades) {
      cumulativePL += trade.realizedPL + trade.financing
      if (cumulativePL > peakEquity) {
        peakEquity = cumulativePL
        peakDate = new Date(trade.closedAt ?? trade.openedAt)
      }
      const drawdown = peakEquity - cumulativePL
      if (drawdown > maxDrawdownAmount) {
        maxDrawdownAmount = drawdown
      }
    }

    const currentEquity = cumulativePL
    const currentDrawdownAmount = peakEquity - currentEquity
    const currentDrawdown = peakEquity > 0 ? (currentDrawdownAmount / peakEquity) * 100 : 0
    const maxDrawdown = peakEquity > 0 ? (maxDrawdownAmount / peakEquity) * 100 : 0

    const drawdownDuration =
      peakDate && currentDrawdownAmount > 0
        ? Math.floor((Date.now() - peakDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0

    return NextResponse.json({
      ok: true,
      data: {
        currentDrawdown,
        maxDrawdown,
        peakEquity,
        currentEquity,
        drawdownDuration,
        currentDrawdownAmount,
        maxDrawdownAmount,
      },
    })
  } catch (error) {
    console.error("[GET /api/risk/drawdown]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
