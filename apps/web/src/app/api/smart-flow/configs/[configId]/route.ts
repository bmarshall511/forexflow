import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getSmartFlowConfig, updateSmartFlowConfig, deleteSmartFlowConfig } from "@fxflow/db"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ configId: string }> },
) {
  try {
    const { configId } = await params
    const config = await getSmartFlowConfig(configId)
    if (!config) {
      return NextResponse.json({ ok: false, error: "Config not found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true, data: config })
  } catch (error) {
    console.error("[GET /api/smart-flow/configs/:id]", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to read SmartFlow config",
      },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> },
) {
  try {
    const { configId } = await params
    const body = await request.json()
    const config = await updateSmartFlowConfig(configId, body)
    return NextResponse.json({ ok: true, data: config })
  } catch (error) {
    console.error("[PATCH /api/smart-flow/configs/:id]", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to update SmartFlow config",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ configId: string }> },
) {
  try {
    const { configId } = await params
    await deleteSmartFlowConfig(configId)
    return NextResponse.json({ ok: true, data: { deleted: true } })
  } catch (error) {
    console.error("[DELETE /api/smart-flow/configs/:id]", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to delete SmartFlow config",
      },
      { status: 500 },
    )
  }
}
