import { NextResponse, type NextRequest } from "next/server"
import { listTags, createTag } from "@fxflow/db"
import type { ApiResponse, TagData } from "@fxflow/types"

export async function GET(): Promise<NextResponse<ApiResponse<TagData[]>>> {
  try {
    const tags = await listTags()
    return NextResponse.json({ ok: true, data: tags })
  } catch (error) {
    console.error("[GET /api/tags]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<TagData>>> {
  try {
    const { name, color } = (await request.json()) as { name: string; color: string }
    if (!name || !color) {
      return NextResponse.json(
        { ok: false, error: "name and color are required" },
        { status: 400 },
      )
    }
    const tag = await createTag(name.trim(), color)
    return NextResponse.json({ ok: true, data: tag })
  } catch (error) {
    console.error("[POST /api/tags]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
