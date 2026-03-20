import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
  getAiTraderConfig,
  updateAiTraderConfig,
  saveAiTraderApiKey,
  deleteAiTraderApiKey,
} from "@fxflow/db"
import type { ApiResponse, AiTraderConfigData } from "@fxflow/types"

export async function GET() {
  try {
    const config = await getAiTraderConfig()
    return NextResponse.json<ApiResponse<AiTraderConfigData>>({
      ok: true,
      data: config,
    })
  } catch (error) {
    console.error("[GET /api/ai-trader/config]", error)
    return NextResponse.json<ApiResponse<AiTraderConfigData>>(
      { ok: false, error: "Failed to read EdgeFinder config" },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if ("fredApiKey" in body) {
      if (typeof body.fredApiKey === "string" && body.fredApiKey.length > 0) {
        await saveAiTraderApiKey("fred", body.fredApiKey)
      } else {
        await deleteAiTraderApiKey("fred")
      }
      delete body.fredApiKey
    }

    if ("alphaVantageApiKey" in body) {
      if (typeof body.alphaVantageApiKey === "string" && body.alphaVantageApiKey.length > 0) {
        await saveAiTraderApiKey("alphaVantage", body.alphaVantageApiKey)
      } else {
        await deleteAiTraderApiKey("alphaVantage")
      }
      delete body.alphaVantageApiKey
    }

    const config = await updateAiTraderConfig(body)
    return NextResponse.json<ApiResponse<AiTraderConfigData>>({
      ok: true,
      data: config,
    })
  } catch (error) {
    console.error("[PUT /api/ai-trader/config]", error)
    return NextResponse.json<ApiResponse<AiTraderConfigData>>(
      { ok: false, error: "Failed to update EdgeFinder config" },
      { status: 500 },
    )
  }
}
