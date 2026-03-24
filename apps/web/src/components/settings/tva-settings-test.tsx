"use client"

import { useState, useCallback, useRef } from "react"
import { Loader2, Check, X, Play, AlertTriangle, FlaskConical } from "lucide-react"
import type { TVAlertSignal } from "@fxflow/types"
import { FOREX_PAIR_GROUPS, formatInstrument } from "@fxflow/shared"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface TestStep {
  label: string
  status: "pending" | "running" | "success" | "failed"
  detail?: string
  error?: string
}

const INITIAL_STEPS: TestStep[] = [
  { label: "Open Position (BUY)", status: "pending" },
  { label: "Flip Position (SELL)", status: "pending" },
  { label: "Close Position", status: "pending" },
]

function friendlyRejection(reason: string, instrument: string): string {
  const pair = formatInstrument(instrument)
  const map: Record<string, string> = {
    manual_position_conflict: `You have a manually-opened position on ${pair}. Pick a different instrument.`,
    cooldown_active: `Cooldown is still active on ${pair}. Try again shortly.`,
    max_positions_reached: "Maximum open auto-trade positions reached.",
    daily_loss_limit: "Daily loss limit reached — circuit breaker is active.",
    market_closed: `Market is closed for ${pair}.`,
    kill_switch_active: "Auto-trading is disabled (kill switch active).",
    pair_not_whitelisted: `${pair} is not in your pair whitelist.`,
    execution_failed: "OANDA is unreachable or order execution failed.",
    same_direction_exists: `An auto-trade in the same direction already exists on ${pair}.`,
    low_confluence: `Signal quality too low for ${pair}. Check confluence settings.`,
  }
  return map[reason] ?? reason
}

export interface TVASettingsTestProps {
  cfWorkerConnected: boolean
  moduleEnabled: boolean
  isConnected: boolean
  sendTestSignal: (
    action: "buy" | "sell",
    ticker: string,
  ) => Promise<{
    cfWorkerResponse: { status: string; reason?: string }
    signalResult: TVAlertSignal | null
    timedOut?: boolean
  }>
  closeTestTrade: (sourceTradeId: string) => Promise<void>
}

export function TVASettingsTest({
  cfWorkerConnected,
  moduleEnabled,
  isConnected,
  sendTestSignal,
  closeTestTrade,
}: TVASettingsTestProps) {
  const [instrument, setInstrument] = useState("EUR_USD")
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<TestStep[]>(INITIAL_STEPS)
  const [allPassed, setAllPassed] = useState<boolean | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const canRun = isConnected && cfWorkerConnected && moduleEnabled && !running

  const updateStep = useCallback((index: number, upd: Partial<TestStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...upd } : s)))
  }, [])

  const startIntermediatePolling = useCallback(
    (stepIndex: number, action: "buy" | "sell", since: Date) => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = setInterval(() => {
        void fetch(`/api/tv-alerts/signals?instrument=${instrument}&pageSize=3&page=1`)
          .then((r) => r.json())
          .then((json: { data?: { signals?: TVAlertSignal[] } }) => {
            const signal = json.data?.signals?.find(
              (s) => s.direction === action && new Date(s.receivedAt) >= since,
            )
            if (!signal) return
            if (signal.status === "received") {
              updateStep(stepIndex, {
                detail: "Signal received by daemon — placing order with OANDA...",
              })
            } else if (signal.status === "executing") {
              updateStep(stepIndex, { detail: "Order submitted — waiting for OANDA fill..." })
            }
          })
          .catch(() => {})
      }, 1500)
    },
    [instrument, updateStep],
  )

  const stopIntermediatePolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  const resolveError = useCallback(
    (result: {
      cfWorkerResponse: { status: string; reason?: string }
      signalResult: TVAlertSignal | null
      timedOut?: boolean
    }): string => {
      if (result.timedOut) {
        return "Signal received by daemon — order is still processing. Check Signal History for the result."
      }
      if (result.cfWorkerResponse.status === "queued") {
        return "Signal queued — daemon isn't connected to CF Worker yet. Check the connection status."
      }
      const raw =
        result.signalResult?.rejectionReason ??
        result.signalResult?.status ??
        result.cfWorkerResponse.reason ??
        "No response from daemon — check that it is running and connected."
      return friendlyRejection(raw, instrument)
    },
    [instrument],
  )

  const handleRunTest = useCallback(async () => {
    setRunning(true)
    setAllPassed(null)
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })))

    const ticker = instrument.replace("_", "")
    let step2TradeId: string | null = null
    let failed = false

    // Step 1: Open (BUY)
    updateStep(0, { status: "running", detail: "Sending signal to CF Worker..." })
    const step1Since = new Date()
    startIntermediatePolling(0, "buy", step1Since)
    try {
      const result = await sendTestSignal("buy", ticker)
      stopIntermediatePolling()
      if (result.signalResult?.status === "executed") {
        const fill = result.signalResult.executionDetails?.fillPrice
        const tradeId = result.signalResult.resultTradeId
        updateStep(0, {
          status: "success",
          detail: `Trade${tradeId ? ` #${tradeId}` : ""} opened${fill ? ` @ ${fill}` : ""}`,
        })
      } else {
        updateStep(0, { status: "failed", error: resolveError(result) })
        failed = true
      }
    } catch (err) {
      stopIntermediatePolling()
      updateStep(0, {
        status: "failed",
        error: err instanceof Error ? err.message : "Request failed",
      })
      failed = true
    }

    if (failed) {
      setAllPassed(false)
      setRunning(false)
      return
    }

    // Step 2: Flip (SELL)
    updateStep(1, { status: "running", detail: "Sending reversal signal to CF Worker..." })
    const step2Since = new Date()
    startIntermediatePolling(1, "sell", step2Since)
    try {
      const result = await sendTestSignal("sell", ticker)
      stopIntermediatePolling()
      if (result.signalResult?.status === "executed") {
        const details = result.signalResult.executionDetails
        const fill = details?.fillPrice
        const closedIds =
          details?.closedTradeIds ?? (details?.closedTradeId ? [details.closedTradeId] : [])
        const newId = result.signalResult.resultTradeId
        step2TradeId = newId
        const closedLabel =
          closedIds.length > 1
            ? `Closed ${closedIds.length} positions, o`
            : closedIds.length === 1
              ? `Closed #${closedIds[0]}, o`
              : "O"
        updateStep(1, {
          status: "success",
          detail: `${closedLabel}pened${newId ? ` #${newId}` : ""}${fill ? ` @ ${fill}` : ""}`,
        })
      } else {
        updateStep(1, { status: "failed", error: resolveError(result) })
        failed = true
      }
    } catch (err) {
      stopIntermediatePolling()
      updateStep(1, {
        status: "failed",
        error: err instanceof Error ? err.message : "Request failed",
      })
      failed = true
    }

    if (failed) {
      setAllPassed(false)
      setRunning(false)
      return
    }

    // Step 3: Close position
    updateStep(2, { status: "running", detail: "Closing position..." })
    if (!step2TradeId) {
      updateStep(2, { status: "failed", error: "No trade ID returned from flip step" })
      setAllPassed(false)
      setRunning(false)
      return
    }

    try {
      await closeTestTrade(step2TradeId)
      updateStep(2, { status: "success", detail: `Trade #${step2TradeId} closed` })
    } catch (err) {
      updateStep(2, {
        status: "failed",
        error: err instanceof Error ? err.message : "Close failed",
      })
      failed = true
    }

    setAllPassed(!failed)
    setRunning(false)
  }, [
    instrument,
    sendTestSignal,
    closeTestTrade,
    updateStep,
    startIntermediatePolling,
    stopIntermediatePolling,
    resolveError,
  ])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FlaskConical className="size-5 text-sky-500" />
          <CardTitle>Test Signal Pipeline</CardTitle>
        </div>
        <CardDescription>
          Verify the full signal pipeline by sending test webhooks through Cloudflare.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Label htmlFor="testInstrument" className="shrink-0">
            Instrument
          </Label>
          <select
            id="testInstrument"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            disabled={running}
            className="border-border bg-background focus:ring-ring h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2"
          >
            {FOREX_PAIR_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.pairs.map((pair) => (
                  <option key={pair.value} value={pair.value}>
                    {pair.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <Button onClick={handleRunTest} disabled={!canRun} size="sm">
            {running ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Play className="mr-2 size-4" />
            )}
            {running ? "Running..." : "Run Test"}
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            This will execute real trades on your connected account. Uses a 3-step sequence: open{" "}
            {formatInstrument(instrument)} BUY, flip to SELL, then close.
          </span>
        </div>

        {!canRun && !running && (
          <p className="text-muted-foreground text-xs">
            {!isConnected
              ? "Daemon not connected."
              : !cfWorkerConnected
                ? "CF Worker not connected. Deploy first."
                : !moduleEnabled
                  ? "Module is disabled. Enable it in the Trading tab."
                  : ""}
          </p>
        )}

        {steps.some((s) => s.status !== "pending") && (
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {step.status === "pending" && (
                    <div className="border-muted size-4 rounded-full border-2" />
                  )}
                  {step.status === "running" && (
                    <Loader2 className="size-4 animate-spin text-blue-500" />
                  )}
                  {step.status === "success" && <Check className="size-4 text-green-500" />}
                  {step.status === "failed" && <X className="size-4 text-red-500" />}
                </div>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      step.status === "pending" && "text-muted-foreground",
                      step.status === "success" && "text-green-600",
                      step.status === "failed" && "text-red-600",
                    )}
                  >
                    Step {i + 1}: {step.label}
                  </p>
                  {step.detail && <p className="text-muted-foreground text-xs">{step.detail}</p>}
                  {step.error && <p className="text-xs text-red-500">{step.error}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {allPassed === true && (
          <p className="text-sm font-medium text-green-600">
            All 3 steps passed — pipeline is working correctly.
          </p>
        )}
        {allPassed === false && (
          <p className="text-sm font-medium text-red-600">
            Test failed — check step details above.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
