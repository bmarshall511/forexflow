import { NextResponse, type NextRequest } from "next/server"
import { getServerDaemonUrl } from "@/lib/daemon-url"

/**
 * Proxy route for daemon REST API calls from remote clients.
 *
 * When accessing FXFlow remotely (via tunnel), the browser can't reach
 * localhost:4100 directly. This route forwards requests to the daemon.
 *
 * Example: GET /api/daemon/status → GET http://localhost:4100/status
 */

const DAEMON_URL = getServerDaemonUrl()

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await params
  const daemonPath = `/${path.join("/")}`

  try {
    const res = await fetch(`${DAEMON_URL}${daemonPath}`, {
      headers: { "Content-Type": "application/json" },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `Daemon unreachable: ${(error as Error).message}` },
      { status: 502 },
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await params
  const daemonPath = `/${path.join("/")}`

  try {
    const body = await request.text()
    const res = await fetch(`${DAEMON_URL}${daemonPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `Daemon unreachable: ${(error as Error).message}` },
      { status: 502 },
    )
  }
}
