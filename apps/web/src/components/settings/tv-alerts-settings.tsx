"use client"

import { useState, useCallback, useRef } from "react"
import {
  Copy,
  RefreshCw,
  Loader2,
  Check,
  X,
  Eye,
  EyeOff,
  ChevronDown,
  Rocket,
  Play,
  AlertTriangle,
} from "lucide-react"
import type { TVAlertsConfig, TVAlertSignal } from "@fxflow/types"
import { TV_ALERTS_DEFAULT_CONFIG } from "@fxflow/types"
import { FOREX_PAIR_GROUPS, formatInstrument } from "@fxflow/shared"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTVAlertsConfig } from "@/hooks/use-tv-alerts-config"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { cn } from "@/lib/utils"

export function TVAlertsSettings() {
  const {
    config,
    isLoading,
    update,
    regenerateToken,
    reconnectCF,
    deployCFWorker,
    sendTestSignal,
    closeTestTrade,
  } = useTVAlertsConfig()
  const { tvAlertsStatus, isConnected } = useDaemonStatus()
  const data = config ?? TV_ALERTS_DEFAULT_CONFIG

  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [cfUrl, setCfUrl] = useState<string | null>(null)
  const [cfSecret, setCfSecret] = useState<string | null>(null)
  const [deploying, setDeploying] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [deploySuccess, setDeploySuccess] = useState(false)

  const handleSave = useCallback(
    async (partial: Partial<TVAlertsConfig>) => {
      setSaving(true)
      try {
        await update(partial)
      } catch (err) {
        console.error("Failed to save:", err)
      } finally {
        setSaving(false)
      }
    },
    [update],
  )

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true)
    try {
      await regenerateToken()
    } catch (err) {
      console.error("Failed to regenerate token:", err)
    } finally {
      setRegenerating(false)
    }
  }, [regenerateToken])

  const copyToClipboard = useCallback((text: string, label: string) => {
    void navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }, [])

  const handleSaveAndConnect = useCallback(async () => {
    setConnecting(true)
    try {
      const updates: Partial<TVAlertsConfig> = {}
      if (cfUrl !== null) updates.cfWorkerUrl = cfUrl
      if (cfSecret !== null) updates.cfWorkerSecret = cfSecret
      if (Object.keys(updates).length > 0) {
        await update(updates)
      }
      await reconnectCF()
    } catch (err) {
      console.error("Failed to connect:", err)
    } finally {
      setConnecting(false)
    }
  }, [cfUrl, cfSecret, update, reconnectCF])

  const handleDeploy = useCallback(async () => {
    setDeploying(true)
    setDeployError(null)
    setDeploySuccess(false)
    try {
      await deployCFWorker()
      setDeploySuccess(true)
      setCfUrl(null)
      setCfSecret(null)
      setTimeout(() => setDeploySuccess(false), 5000)
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : "Deploy failed")
    } finally {
      setDeploying(false)
    }
  }, [deployCFWorker])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  let webhookUrl = "Generate a token first"
  if (data.webhookToken) {
    try {
      const workerHost = data.cfWorkerUrl ? new URL(data.cfWorkerUrl).host : null
      webhookUrl = workerHost
        ? `https://${workerHost}/webhook/${data.webhookToken}`
        : `https://fxflow-tv-alerts.<your-subdomain>.workers.dev/webhook/${data.webhookToken}`
    } catch {
      webhookUrl = `https://fxflow-tv-alerts.<your-subdomain>.workers.dev/webhook/${data.webhookToken}`
    }
  }

  const buyTemplate = JSON.stringify(
    {
      action: "buy",
      ticker: "{{ticker}}",
      price: "{{close}}",
      time: "{{timenow}}",
      interval: "{{interval}}",
    },
    null,
    2,
  )
  const sellTemplate = JSON.stringify(
    {
      action: "sell",
      ticker: "{{ticker}}",
      price: "{{close}}",
      time: "{{timenow}}",
      interval: "{{interval}}",
    },
    null,
    2,
  )

  // Key forces uncontrolled inputs to re-mount when config changes
  const formKey = `${data.positionSizePercent}-${data.cooldownSeconds}-${data.maxOpenPositions}-${data.dailyLossLimit}-${data.dedupWindowSeconds}-${data.cfWorkerUrl}-${data.cfWorkerSecret}`

  const cfWorkerConnected = tvAlertsStatus?.cfWorkerConnected ?? false
  const cfConnectionStatus = !isConnected
    ? "No daemon"
    : cfWorkerConnected
      ? "Connected"
      : data.cfWorkerUrl
        ? "Disconnected"
        : "Not configured"
  const cfDotColor = !isConnected
    ? "bg-muted-foreground"
    : cfWorkerConnected
      ? "bg-green-500"
      : "bg-red-500"

  return (
    <div className="space-y-6" key={formKey}>
      {/* CF Worker Connection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>CF Worker Connection</CardTitle>
              <CardDescription>
                Connect to your Cloudflare Worker for receiving TradingView webhook signals.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", cfDotColor)} />
              <span className="text-muted-foreground text-xs">{cfConnectionStatus}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleDeploy} disabled={deploying || connecting} className="w-full">
            {deploying ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : deploySuccess ? (
              <Check className="mr-2 size-4" />
            ) : (
              <Rocket className="mr-2 size-4" />
            )}
            {deploying
              ? "Deploying to Cloudflare..."
              : deploySuccess
                ? "Deployed!"
                : "Deploy Worker"}
          </Button>

          {deployError && <p className="text-xs text-red-500">{deployError}</p>}
          {deploySuccess && (
            <p className="text-xs text-green-500">
              Worker deployed, secrets set, and connection configured automatically.
            </p>
          )}

          <p className="text-muted-foreground text-xs">
            Requires a free Cloudflare account. If you&apos;re not logged in, a browser window will
            open automatically.
          </p>

          <ManualConfiguration
            data={data}
            showSecret={showSecret}
            setShowSecret={setShowSecret}
            setCfUrl={setCfUrl}
            setCfSecret={setCfSecret}
            connecting={connecting}
            deploying={deploying}
            onSaveAndConnect={handleSaveAndConnect}
          />
        </CardContent>
      </Card>

      {/* Test Signal Pipeline */}
      <TestSignalCard
        cfWorkerConnected={cfWorkerConnected}
        moduleEnabled={data.enabled}
        isConnected={isConnected}
        sendTestSignal={sendTestSignal}
        closeTestTrade={closeTestTrade}
      />

      {/* Module Status */}
      <Card>
        <CardHeader>
          <CardTitle>Module Status</CardTitle>
          <CardDescription>
            Enable or disable the TradingView Alerts auto-trading module.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-Trading</p>
              <p className="text-muted-foreground text-xs">
                {data.enabled ? "Module is active and processing signals" : "Module is disabled"}
              </p>
            </div>
            <Button
              variant={data.enabled ? "destructive" : "default"}
              size="sm"
              onClick={() => handleSave({ enabled: !data.enabled })}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 size-3 animate-spin" />}
              {data.enabled ? "Disable" : "Enable"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Setup */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Setup</CardTitle>
          <CardDescription>Configure the webhook URL for TradingView alerts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUrl, "url")}
              >
                {copied === "url" ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating}>
            {regenerating ? (
              <Loader2 className="mr-2 size-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-3" />
            )}
            Regenerate Token
          </Button>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Buy Alert Template</Label>
              <div className="relative">
                <pre className="bg-muted max-h-32 overflow-auto rounded-md p-3 text-xs">
                  {buyTemplate}
                </pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 size-6"
                  onClick={() => copyToClipboard(buyTemplate, "buy")}
                >
                  {copied === "buy" ? <Check className="size-3" /> : <Copy className="size-3" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sell Alert Template</Label>
              <div className="relative">
                <pre className="bg-muted max-h-32 overflow-auto rounded-md p-3 text-xs">
                  {sellTemplate}
                </pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 size-6"
                  onClick={() => copyToClipboard(sellTemplate, "sell")}
                >
                  {copied === "sell" ? <Check className="size-3" /> : <Copy className="size-3" />}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Position Sizing */}
      <Card>
        <CardHeader>
          <CardTitle>Position Sizing</CardTitle>
          <CardDescription>Percentage of account balance used for each auto-trade.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="positionSize" className="shrink-0">
              Size (%)
            </Label>
            <Input
              id="positionSize"
              type="number"
              min={0.1}
              max={100}
              step={0.1}
              defaultValue={data.positionSizePercent}
              className="w-28"
              onBlur={(e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val) && val >= 0.1 && val <= 100) {
                  void handleSave({ positionSizePercent: val })
                }
              }}
            />
            <span className="text-muted-foreground text-xs">of account balance</span>
          </div>
        </CardContent>
      </Card>

      {/* Safety Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Safety Controls</CardTitle>
          <CardDescription>Configure trading safeguards and risk limits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cooldown">Cooldown (seconds)</Label>
              <Input
                id="cooldown"
                type="number"
                min={0}
                defaultValue={data.cooldownSeconds}
                className="w-full"
                onBlur={(e) => {
                  const val = parseInt(e.target.value)
                  if (!isNaN(val) && val >= 0) void handleSave({ cooldownSeconds: val })
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxPositions">Max Open Positions</Label>
              <Input
                id="maxPositions"
                type="number"
                min={1}
                max={20}
                defaultValue={data.maxOpenPositions}
                className="w-full"
                onBlur={(e) => {
                  const val = parseInt(e.target.value)
                  if (!isNaN(val) && val >= 1) void handleSave({ maxOpenPositions: val })
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dailyLoss">Daily Loss Limit ($)</Label>
              <Input
                id="dailyLoss"
                type="number"
                min={0}
                step={1}
                defaultValue={data.dailyLossLimit}
                className="w-full"
                onBlur={(e) => {
                  const val = parseFloat(e.target.value)
                  if (!isNaN(val) && val >= 0) void handleSave({ dailyLossLimit: val })
                }}
              />
              <p className="text-muted-foreground text-xs">0 = no limit</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dedupWindow">Dedup Window (seconds)</Label>
              <Input
                id="dedupWindow"
                type="number"
                min={1}
                defaultValue={data.dedupWindowSeconds}
                className="w-full"
                onBlur={(e) => {
                  const val = parseInt(e.target.value)
                  if (!isNaN(val) && val >= 1) void handleSave({ dedupWindowSeconds: val })
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.marketHoursFilter}
                onChange={(e) => void handleSave({ marketHoursFilter: e.target.checked })}
                className="border-border rounded"
              />
              Market hours filter
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.showChartMarkers}
                onChange={(e) => void handleSave({ showChartMarkers: e.target.checked })}
                className="border-border rounded"
              />
              Show chart markers
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.soundEnabled}
                onChange={(e) => void handleSave({ soundEnabled: e.target.checked })}
                className="border-border rounded"
              />
              Sound notifications
            </label>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Manual Configuration (Advanced) ────────────────────────────────────── */

function ManualConfiguration({
  data,
  showSecret,
  setShowSecret,
  setCfUrl,
  setCfSecret,
  connecting,
  deploying,
  onSaveAndConnect,
}: {
  data: TVAlertsConfig
  showSecret: boolean
  setShowSecret: (v: boolean) => void
  setCfUrl: (v: string) => void
  setCfSecret: (v: string) => void
  connecting: boolean
  deploying: boolean
  onSaveAndConnect: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors"
        >
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
          <span className="font-medium">Manual Configuration</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-border bg-muted/20 mt-3 space-y-4 rounded-md border p-4">
          <div className="space-y-2">
            <Label htmlFor="cfWorkerUrl">WebSocket URL</Label>
            <Input
              id="cfWorkerUrl"
              type="url"
              placeholder="wss://fxflow-tv-alerts.your-worker.workers.dev/ws/daemon-secret"
              defaultValue={data.cfWorkerUrl}
              onChange={(e) => setCfUrl(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cfWorkerSecret">Authentication Secret</Label>
            <div className="flex gap-2">
              <Input
                id="cfWorkerSecret"
                type={showSecret ? "text" : "password"}
                placeholder="Enter daemon authentication secret"
                defaultValue={data.cfWorkerSecret}
                onChange={(e) => setCfSecret(e.target.value)}
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSecret(!showSecret)}
                aria-label={showSecret ? "Hide secret" : "Show secret"}
              >
                {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={onSaveAndConnect}
            disabled={connecting || deploying}
          >
            {connecting && <Loader2 className="mr-2 size-3 animate-spin" />}
            Save & Connect
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/* ─── Test Signal Pipeline ──────────────────────────────────────────────── */

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

/** Map rejection reason codes to user-friendly messages */
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
  }
  return map[reason] ?? reason
}

function TestSignalCard({
  cfWorkerConnected,
  moduleEnabled,
  isConnected,
  sendTestSignal,
  closeTestTrade,
}: {
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
}) {
  const [instrument, setInstrument] = useState("EUR_USD")
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<TestStep[]>(INITIAL_STEPS)
  const [allPassed, setAllPassed] = useState<boolean | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const canRun = isConnected && cfWorkerConnected && moduleEnabled && !running

  const updateStep = useCallback((index: number, update: Partial<TestStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...update } : s)))
  }, [])

  /** Start client-side polling to show intermediate signal status while the API call is in-flight. */
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
          .catch(() => {
            /* best-effort */
          })
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

  /** Derive a user-friendly error string from the test signal result. */
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
        return "Signal queued — daemon isn't connected to CF Worker yet. Check the connection status above."
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
        <CardTitle>Test Signal Pipeline</CardTitle>
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

        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-600">
            This will execute real trades on your connected account. Uses a 3-step sequence: open{" "}
            {formatInstrument(instrument)} BUY, flip to SELL, then close.
          </p>
        </div>

        {!canRun && !running && (
          <p className="text-muted-foreground text-xs">
            {!isConnected
              ? "Daemon not connected."
              : !cfWorkerConnected
                ? "CF Worker not connected. Deploy first."
                : !moduleEnabled
                  ? "Module is disabled. Enable it above."
                  : ""}
          </p>
        )}

        {/* Step indicators */}
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
