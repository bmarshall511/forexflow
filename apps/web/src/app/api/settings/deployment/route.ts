import { NextResponse } from "next/server"
import { getDeploymentSettings, setDeploymentMode, setCloudDaemonUrl } from "@fxflow/db"
import type { DeploymentMode } from "@fxflow/shared"

export async function GET() {
  try {
    const settings = await getDeploymentSettings()
    return NextResponse.json({ ok: true, data: settings })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      mode?: DeploymentMode
      cloudDaemonUrl?: string | null
    }

    if (body.mode) {
      await setDeploymentMode(body.mode)
    }

    if (body.cloudDaemonUrl !== undefined) {
      await setCloudDaemonUrl(body.cloudDaemonUrl)
    }

    const updated = await getDeploymentSettings()
    return NextResponse.json({ ok: true, data: updated })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
