"use client"

import { useState, useCallback } from "react"
import {
  Copy,
  RefreshCw,
  Loader2,
  Check,
  Rocket,
  ChevronDown,
  Eye,
  EyeOff,
  Plug,
  Webhook,
} from "lucide-react"
import type { TVAlertsConfig } from "@fxflow/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export interface TVASettingsConnectionProps {
  config: TVAlertsConfig
  onUpdate: (partial: Partial<TVAlertsConfig>) => Promise<void>
  saving: boolean
  daemonUp: boolean
  cfConnected: boolean
  regenerateToken: () => Promise<string>
  reconnectCF: () => Promise<void>
  deployCFWorker: () => Promise<{ workerUrl: string; cfWorkerUrl: string; webhookUrl: string }>
}

export function TVASettingsConnection({
  config,
  onUpdate,
  daemonUp,
  cfConnected,
  regenerateToken,
  deployCFWorker,
}: TVASettingsConnectionProps) {
  const [deploying, setDeploying] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [deploySuccess, setDeploySuccess] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [cfUrl, setCfUrl] = useState<string | null>(null)
  const [cfSecret, setCfSecret] = useState<string | null>(null)

  const cfConnectionStatus = !daemonUp
    ? "No daemon"
    : cfConnected
      ? "Connected"
      : config.cfWorkerUrl
        ? "Disconnected"
        : "Not configured"
  const cfDotColor = !daemonUp ? "bg-muted-foreground" : cfConnected ? "bg-green-500" : "bg-red-500"

  const copyToClipboard = useCallback((text: string, label: string) => {
    void navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }, [])

  const handleDeploy = useCallback(async () => {
    setDeploying(true)
    setDeployError(null)
    setDeploySuccess(false)
    try {
      await deployCFWorker()
      setDeploySuccess(true)
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : "Deploy failed")
    } finally {
      setDeploying(false)
    }
  }, [deployCFWorker])

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

  const handleSaveAndConnect = useCallback(async () => {
    setConnecting(true)
    try {
      const updates: Partial<TVAlertsConfig> = {}
      if (cfUrl !== null) updates.cfWorkerUrl = cfUrl
      if (cfSecret !== null) updates.cfWorkerSecret = cfSecret
      await onUpdate(updates)
    } catch (err) {
      console.error("Failed to save:", err)
    } finally {
      setConnecting(false)
    }
  }, [cfUrl, cfSecret, onUpdate])

  let webhookUrl = "Generate a token first"
  if (config.webhookToken) {
    try {
      const workerHost = config.cfWorkerUrl ? new URL(config.cfWorkerUrl).host : null
      webhookUrl = workerHost
        ? `https://${workerHost}/webhook/${config.webhookToken}`
        : `https://fxflow-tv-alerts.<your-subdomain>.workers.dev/webhook/${config.webhookToken}`
    } catch {
      webhookUrl = `https://fxflow-tv-alerts.<your-subdomain>.workers.dev/webhook/${config.webhookToken}`
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

  return (
    <div className="space-y-6">
      {/* CF Worker */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plug className="size-5 text-blue-500" />
            <CardTitle>Cloudflare Worker</CardTitle>
          </div>
          <CardDescription>
            Connect to your Cloudflare Worker for receiving TradingView webhook signals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", cfDotColor)} />
              <span className="text-sm">{cfConnectionStatus}</span>
            </div>
          </div>

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

          <ManualConfig
            config={config}
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

      {/* Webhook Setup */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="size-5 text-emerald-500" />
            <CardTitle>Webhook Setup</CardTitle>
          </div>
          <CardDescription>
            Copy the webhook URL and alert templates into your TradingView alerts.
          </CardDescription>
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
                aria-label="Copy webhook URL"
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

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <TemplateBlock
              label="Buy Alert Template"
              template={buyTemplate}
              copyKey="buy"
              copied={copied}
              onCopy={copyToClipboard}
            />
            <TemplateBlock
              label="Sell Alert Template"
              template={sellTemplate}
              copyKey="sell"
              copied={copied}
              onCopy={copyToClipboard}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TemplateBlock({
  label,
  template,
  copyKey,
  copied,
  onCopy,
}: {
  label: string
  template: string
  copyKey: string
  copied: string | null
  onCopy: (text: string, label: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <pre className="bg-muted max-h-32 overflow-auto rounded-md p-3 text-xs">{template}</pre>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1 size-6"
          onClick={() => onCopy(template, copyKey)}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied === copyKey ? <Check className="size-3" /> : <Copy className="size-3" />}
        </Button>
      </div>
    </div>
  )
}

function ManualConfig({
  config,
  showSecret,
  setShowSecret,
  setCfUrl,
  setCfSecret,
  connecting,
  deploying,
  onSaveAndConnect,
}: {
  config: TVAlertsConfig
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
              defaultValue={config.cfWorkerUrl}
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
                defaultValue={config.cfWorkerSecret}
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
