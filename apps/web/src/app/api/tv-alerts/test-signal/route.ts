import { NextResponse } from "next/server"
import { getTVAlertsConfig, listSignals, findOrCreateTag, assignTagToTrade, getTradeBySourceId, markSignalAsTest } from "@fxflow/db"
import { mapTVTickerToOandaInstrument } from "@fxflow/shared"
import type { ApiResponse, TVAlertSignal } from "@fxflow/types"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

interface TestSignalResult {
  cfWorkerResponse: { status: string; instrument?: string; action?: string; reason?: string }
  signalResult: TVAlertSignal | null
  /** True when the signal was received by the daemon but didn't reach a final state within the timeout. */
  timedOut?: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<TestSignalResult>>> {
  try {
    const body = await request.json() as { action?: string; ticker?: string }
    const action = body.action
    const ticker = body.ticker

    if (!action || (action !== "buy" && action !== "sell")) {
      return NextResponse.json({ ok: false, error: "action must be 'buy' or 'sell'" }, { status: 400 })
    }
    if (!ticker || typeof ticker !== "string") {
      return NextResponse.json({ ok: false, error: "ticker is required" }, { status: 400 })
    }

    const instrument = mapTVTickerToOandaInstrument(ticker)
    if (!instrument) {
      return NextResponse.json({ ok: false, error: `Unknown instrument: ${ticker}` }, { status: 400 })
    }

    // 1. Read config
    const config = await getTVAlertsConfig()
    if (!config.cfWorkerUrl || !config.webhookToken) {
      return NextResponse.json(
        { ok: false, error: "CF Worker not configured. Deploy the worker first." },
        { status: 400 },
      )
    }

    // 2. Clear cooldown on daemon (best-effort)
    try {
      await fetch(`${DAEMON_URL}/actions/tv-alerts/clear-cooldown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrument }),
      })
    } catch {
      // Daemon might not be running — continue anyway
    }

    // 3. Build webhook URL from cfWorkerUrl
    const cfHost = new URL(config.cfWorkerUrl.replace("wss://", "https://").replace("ws://", "http://")).host
    const protocol = config.cfWorkerUrl.startsWith("wss://") ? "https" : "http"
    const webhookUrl = `${protocol}://${cfHost}/webhook/${config.webhookToken}`

    // 4. Send webhook (like TradingView would, with test signal header to bypass IP check)
    const sendTime = new Date()
    const cfRes = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-Signal": config.cfWorkerSecret,
      },
      body: JSON.stringify({ action, ticker }),
    })

    let cfWorkerResponse: TestSignalResult["cfWorkerResponse"]
    try {
      cfWorkerResponse = await cfRes.json() as TestSignalResult["cfWorkerResponse"]
    } catch {
      return NextResponse.json(
        { ok: false, error: `CF Worker returned status ${cfRes.status} with non-JSON response` },
        { status: 502 },
      )
    }

    if (cfWorkerResponse.status !== "ok" && cfWorkerResponse.status !== "queued") {
      return NextResponse.json({
        ok: true,
        data: { cfWorkerResponse, signalResult: null },
      })
    }

    // 5. Phase 1: Wait for the signal to appear in any status (up to 5s).
    //    This confirms the daemon received and created the signal record.
    let foundSignalId: string | null = null
    for (let i = 0; i < 10; i++) {
      await sleep(500)
      const { signals } = await listSignals({ instrument, pageSize: 5, page: 1 })
      const match = signals.find(
        (s) => s.direction === action && new Date(s.receivedAt) >= sendTime,
      )
      if (match) {
        foundSignalId = match.id
        break
      }
    }

    // 6. Phase 2: Wait for the signal to reach a final state (up to 20s).
    //    The full pipeline (OANDA order placement + two reconcile cycles) can take 8–12s.
    let signalResult: TVAlertSignal | null = null
    let timedOut = false

    if (foundSignalId) {
      for (let i = 0; i < 40; i++) {
        await sleep(500)
        const { signals } = await listSignals({ instrument, pageSize: 5, page: 1 })
        const match = signals.find(
          (s) => s.id === foundSignalId &&
            s.status !== "received" &&
            s.status !== "executing",
        )
        if (match) {
          signalResult = match
          break
        }
      }

      if (!signalResult) {
        // Signal was received but didn't finish within 20s — return partial result with timedOut flag
        const { signals } = await listSignals({ instrument, pageSize: 5, page: 1 })
        signalResult = signals.find((s) => s.id === foundSignalId) ?? null
        timedOut = true
      }
    }

    // 7. Mark signal as test + tag the resulting trade (best-effort)
    if (signalResult) {
      try {
        await markSignalAsTest(signalResult.id)
        signalResult = { ...signalResult, isTest: true }
      } catch {
        // Non-critical
      }

      if (signalResult.resultTradeId) {
        try {
          const trade = await getTradeBySourceId("oanda", signalResult.resultTradeId)
          if (trade) {
            const testTag = await findOrCreateTag("Test", "#f59e0b")
            await assignTagToTrade(trade.id, testTag.id)
          }
        } catch {
          // Non-critical
        }
      }
    }

    return NextResponse.json({
      ok: true,
      data: { cfWorkerResponse, signalResult, timedOut: timedOut || undefined },
    })
  } catch (error) {
    console.error("[POST /api/tv-alerts/test-signal]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
