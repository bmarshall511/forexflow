import { NextResponse } from "next/server"
import { db } from "@fxflow/db"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

export async function GET() {
  // Fetch daemon health and DB storage stats in parallel
  const [daemonResult, storageResult] = await Promise.allSettled([
    fetch(`${DAEMON_URL}/health/detailed`, { signal: AbortSignal.timeout(5000) }).then((r) =>
      r.ok ? (r.json() as Promise<{ ok: boolean; data: Record<string, unknown> }>) : null,
    ),
    getStorageStats(),
  ])

  const daemon = daemonResult.status === "fulfilled" ? (daemonResult.value?.data ?? null) : null
  const storage = storageResult.status === "fulfilled" ? storageResult.value : null
  const daemonReachable = daemon !== null

  return NextResponse.json({
    ok: true,
    data: { daemon, daemonReachable, storage },
  })
}

async function getStorageStats() {
  const [trades, signals, analyses, conditions, setups, opportunities, notifications, zones] =
    await Promise.all([
      db.trade.count(),
      db.tVAlertSignal.count(),
      db.aiAnalysis.count(),
      db.tradeCondition.count(),
      db.tradeFinderSetup.count(),
      db.aiTraderOpportunity.count(),
      db.notification.count(),
      db.supplyDemandZone.count(),
    ])

  return {
    trades,
    signals,
    analyses,
    conditions,
    setups,
    opportunities,
    notifications,
    zones,
    total:
      trades + signals + analyses + conditions + setups + opportunities + notifications + zones,
  }
}
