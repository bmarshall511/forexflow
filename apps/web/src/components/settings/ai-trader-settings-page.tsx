"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import type { AiTraderProfile, AiTraderTechnique } from "@fxflow/types"
import { AI_MODEL_OPTIONS } from "@fxflow/types"
import {
  Bot,
  Gauge,
  DollarSign,
  Cpu,
  KeyRound,
  CheckCircle2,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react"
import { AiTraderScanConfig } from "./ai-trader-scan-config"
import { SettingsPresets } from "./settings-presets"

// ─── Types ──────────────────────────────────────────────────────────────────

interface AiTraderConfig {
  enabled: boolean
  operatingMode: "manual" | "semi_auto" | "full_auto"
  scanIntervalMinutes: number
  maxConcurrentTrades: number
  minimumConfidence: number
  confidenceThreshold: number
  dailyBudgetUsd: number
  monthlyBudgetUsd: number
  scanModel: string
  decisionModel: string
  pairWhitelist: string[]
  enabledProfiles: Record<AiTraderProfile, boolean>
  enabledTechniques: Record<AiTraderTechnique, boolean>
  fredApiKey: boolean
  alphaVantageApiKey: boolean
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const selectClass =
  "flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

// ─── Toggle ─────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`focus-visible:ring-ring relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-primary" : "bg-input"}`}
    >
      <span
        className={`bg-background pointer-events-none inline-block h-4 w-4 rounded-full shadow-lg ring-0 transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  )
}

// ─── API Key Field ──────────────────────────────────────────────────────────

function ApiKeyField({
  label,
  description,
  hasKey,
  onSave,
  onRemove,
}: {
  label: string
  description: React.ReactNode
  hasKey: boolean
  onSave: (key: string) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const [value, setValue] = useState("")
  const [showInput, setShowInput] = useState(false)
  const [showValue, setShowValue] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!value.trim()) return
    setSaving(true)
    try {
      await onSave(value.trim())
      setValue("")
      setShowInput(false)
      toast.success(`${label} saved`)
    } catch {
      toast.error(`Failed to save ${label}`)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setSaving(true)
    try {
      await onRemove()
      toast.success(`${label} removed`)
    } catch {
      toast.error(`Failed to remove ${label}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <p className="text-muted-foreground text-xs">{description}</p>
      {hasKey ? (
        <div className="flex items-center gap-2">
          <div className="bg-muted flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs">
            <CheckCircle2 className="size-3 text-emerald-500" />
            <span>Configured</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive h-7 gap-1 text-xs"
            onClick={() => void handleRemove()}
            disabled={saving}
          >
            <Trash2 className="size-3" /> Remove
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowInput(!showInput)}
          >
            Replace
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowInput(true)}
        >
          Add Key
        </Button>
      )}
      {showInput && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={showValue ? "text" : "password"}
              placeholder="Paste API key…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 pr-8 text-xs"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowValue(!showValue)}
              className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
            >
              {showValue ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            </button>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => void handleSave()}
            disabled={!value.trim() || saving}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setShowInput(false)
              setValue("")
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function AiTraderSettingsPage() {
  const [config, setConfig] = useState<AiTraderConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const hasFetchedOnce = useRef(false)

  const fetchConfig = useCallback(async () => {
    if (!hasFetchedOnce.current) setIsLoading(true)
    try {
      const res = await fetch("/api/ai-trader/config")
      const json = (await res.json()) as { ok: boolean; data: AiTraderConfig }
      if (json.ok) setConfig(json.data)
    } catch {
      toast.error("Failed to load AI Trader config")
    } finally {
      setIsLoading(false)
      hasFetchedOnce.current = true
    }
  }, [])

  useEffect(() => {
    void fetchConfig()
  }, [fetchConfig])

  // Sync when config is changed externally (e.g. header automation toggle)
  useEffect(() => {
    const handler = () => void fetchConfig()
    window.addEventListener("ai-trader-config-changed", handler)
    return () => window.removeEventListener("ai-trader-config-changed", handler)
  }, [fetchConfig])

  const save = async (updates: Partial<AiTraderConfig>) => {
    if (!config) return
    const updated = { ...config, ...updates }
    setConfig(updated)
    setSaving(true)
    try {
      const res = await fetch("/api/ai-trader/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      const json = (await res.json()) as { ok: boolean }
      if (!json.ok) throw new Error("Save failed")
      toast.success("Settings saved")
      window.dispatchEvent(new Event("ai-trader-config-changed"))
    } catch {
      toast.error("Failed to save settings")
      void fetchConfig()
    } finally {
      setSaving(false)
    }
  }

  const saveApiKey = async (field: string, key: string) => {
    const res = await fetch("/api/ai-trader/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: key }),
    })
    const json = (await res.json()) as { ok: boolean }
    if (!json.ok) throw new Error("Save failed")
    void fetchConfig()
    window.dispatchEvent(new Event("ai-trader-config-changed"))
  }

  const removeApiKey = async (field: string) => {
    const res = await fetch("/api/ai-trader/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: null }),
    })
    const json = (await res.json()) as { ok: boolean }
    if (!json.ok) throw new Error("Remove failed")
    void fetchConfig()
    window.dispatchEvent(new Event("ai-trader-config-changed"))
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!config) {
    return <p className="text-muted-foreground text-sm">Failed to load AI Trader settings.</p>
  }

  return (
    <div className="space-y-6">
      {/* ── Quick Setup Presets ── */}
      <SettingsPresets onApply={(values) => void save(values)} disabled={saving} />

      {/* ── General Settings ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="text-primary size-4" />
            General Settings
          </CardTitle>
          <CardDescription>Core AI Trader configuration and operating mode.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm">Enabled</p>
              <p className="text-muted-foreground text-xs">Master toggle for the AI Trader</p>
            </div>
            <Toggle
              checked={config.enabled}
              onChange={(v) => void save({ enabled: v })}
              disabled={saving}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs">Operating Mode</Label>
            <select
              value={config.operatingMode}
              onChange={(e) =>
                void save({ operatingMode: e.target.value as AiTraderConfig["operatingMode"] })
              }
              disabled={saving}
              className={selectClass}
            >
              <option value="manual">Manual — Review and approve all trades</option>
              <option value="semi_auto">Semi-Auto — Auto-execute high confidence trades</option>
              <option value="full_auto">Full Auto — Fully autonomous trading</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Scan Interval (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                className="h-8 text-xs"
                value={config.scanIntervalMinutes}
                onChange={(e) => void save({ scanIntervalMinutes: parseInt(e.target.value) || 5 })}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Max Concurrent Trades</Label>
              <Input
                type="number"
                min={1}
                max={20}
                className="h-8 text-xs"
                value={config.maxConcurrentTrades}
                onChange={(e) => void save({ maxConcurrentTrades: parseInt(e.target.value) || 3 })}
                disabled={saving}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Confidence Thresholds ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="size-4 text-amber-500" />
            Confidence Thresholds
          </CardTitle>
          <CardDescription>
            Minimum confidence levels for trade identification and execution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Minimum Confidence (%)</Label>
              <p className="text-muted-foreground text-[11px]">
                Below this, opportunities are ignored
              </p>
              <Input
                type="number"
                min={0}
                max={100}
                className="h-8 text-xs"
                value={config.minimumConfidence}
                onChange={(e) => void save({ minimumConfidence: parseInt(e.target.value) || 0 })}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Auto-Execute Threshold (%)</Label>
              <p className="text-muted-foreground text-[11px]">
                Above this, trades auto-execute in semi/full auto
              </p>
              <Input
                type="number"
                min={0}
                max={100}
                className="h-8 text-xs"
                value={config.confidenceThreshold}
                onChange={(e) => void save({ confidenceThreshold: parseInt(e.target.value) || 80 })}
                disabled={saving}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Budget Limits ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="size-4 text-emerald-500" />
            Budget Limits
          </CardTitle>
          <CardDescription>AI API spending caps to control costs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Daily Budget (USD)</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                className="h-8 text-xs"
                value={config.dailyBudgetUsd}
                onChange={(e) => void save({ dailyBudgetUsd: parseFloat(e.target.value) || 0 })}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Monthly Budget (USD)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                className="h-8 text-xs"
                value={config.monthlyBudgetUsd}
                onChange={(e) => void save({ monthlyBudgetUsd: parseFloat(e.target.value) || 0 })}
                disabled={saving}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── AI Models ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="size-4 text-violet-500" />
            AI Models
          </CardTitle>
          <CardDescription>
            Select which Claude models to use for scanning and decision-making.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Scan Model (Tier 2)</Label>
            <p className="text-muted-foreground text-[11px]">
              Used for initial market scanning and opportunity detection
            </p>
            <select
              value={config.scanModel}
              onChange={(e) => void save({ scanModel: e.target.value })}
              disabled={saving}
              className={selectClass}
            >
              {AI_MODEL_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name} — {opt.description}
                </option>
              ))}
            </select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs">Decision Model (Tier 3)</Label>
            <p className="text-muted-foreground text-[11px]">
              Used for final trade decisions and risk assessment
            </p>
            <select
              value={config.decisionModel}
              onChange={(e) => void save({ decisionModel: e.target.value })}
              disabled={saving}
              className={selectClass}
            >
              {AI_MODEL_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name} — {opt.description}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* ── Scan Configuration ── */}
      <AiTraderScanConfig
        pairWhitelist={config.pairWhitelist}
        enabledProfiles={config.enabledProfiles}
        enabledTechniques={config.enabledTechniques}
        saving={saving}
        onSave={save}
      />

      {/* ── API Keys ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-orange-500" />
            API Keys
          </CardTitle>
          <CardDescription>
            External data provider keys for market analysis context.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ApiKeyField
            label="FRED API Key"
            description={
              <>
                Federal Reserve Economic Data. Provides macroeconomic indicators for trade context.{" "}
                <a
                  href="https://fred.stlouisfed.org/docs/api/api_key.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-0.5 hover:underline"
                >
                  Get a free key <ExternalLink className="size-2.5" />
                </a>
              </>
            }
            hasKey={config.fredApiKey}
            onSave={(key) => saveApiKey("fredApiKey", key)}
            onRemove={() => removeApiKey("fredApiKey")}
          />

          <Separator />

          <ApiKeyField
            label="Alpha Vantage API Key"
            description={
              <>
                Market data and technical indicators.{" "}
                <a
                  href="https://www.alphavantage.co/support/#api-key"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-0.5 hover:underline"
                >
                  Get a free key <ExternalLink className="size-2.5" />
                </a>
              </>
            }
            hasKey={config.alphaVantageApiKey}
            onSave={(key) => saveApiKey("alphaVantageApiKey", key)}
            onRemove={() => removeApiKey("alphaVantageApiKey")}
          />
        </CardContent>
      </Card>
    </div>
  )
}
