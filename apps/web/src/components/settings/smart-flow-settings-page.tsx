"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { Zap, DollarSign, ShieldCheck } from "lucide-react"
import type { SmartFlowSettingsData, SmartFlowPreset } from "@fxflow/types"

const selectClass =
  "flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

const PRESET_OPTIONS: { value: SmartFlowPreset; label: string }[] = [
  { value: "momentum_catch", label: "Momentum Catch" },
  { value: "steady_growth", label: "Steady Growth" },
  { value: "swing_capture", label: "Swing Capture" },
  { value: "trend_rider", label: "Trend Rider" },
  { value: "recovery", label: "Recovery" },
]

export function SmartFlowSettingsPage() {
  const [settings, setSettings] = useState<SmartFlowSettingsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const hasFetchedOnce = useRef(false)

  const fetchSettings = useCallback(async () => {
    if (!hasFetchedOnce.current) setIsLoading(true)
    try {
      const res = await fetch("/api/smart-flow/settings")
      const json = (await res.json()) as { ok: boolean; data?: SmartFlowSettingsData }
      if (json.ok && json.data) setSettings(json.data)
    } catch {
      toast.error("Failed to load SmartFlow settings")
    } finally {
      setIsLoading(false)
      hasFetchedOnce.current = true
    }
  }, [])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  const save = async (updates: Partial<SmartFlowSettingsData>) => {
    if (!settings) return
    setSettings({ ...settings, ...updates })
    setSaving(true)
    try {
      const res = await fetch("/api/smart-flow/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      const json = (await res.json()) as { ok: boolean }
      if (!json.ok) throw new Error("Save failed")
      toast.success("Settings saved")
    } catch {
      toast.error("Failed to save settings")
      void fetchSettings()
    } finally {
      setSaving(false)
    }
  }

  if (isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  if (!settings)
    return <p className="text-muted-foreground text-sm">Failed to load SmartFlow settings.</p>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="text-primary size-4" />
            General
          </CardTitle>
          <CardDescription>Core SmartFlow engine configuration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm">Enabled</p>
              <p className="text-muted-foreground text-xs">Master toggle for SmartFlow</p>
            </div>
            <ToggleSwitch
              checked={settings.enabled}
              onChange={(v) => void save({ enabled: v })}
              disabled={saving}
            />
          </div>
          <Separator />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Max Concurrent Trades</Label>
              <Input
                type="number"
                min={1}
                max={20}
                className="h-8 text-xs"
                value={settings.maxConcurrentTrades}
                onChange={(e) => void save({ maxConcurrentTrades: parseInt(e.target.value) || 3 })}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Max Margin (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                step={1}
                className="h-8 text-xs"
                value={settings.maxMarginPercent}
                onChange={(e) => void save({ maxMarginPercent: parseFloat(e.target.value) || 50 })}
                disabled={saving}
              />
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs">Default Preset</Label>
            <select
              value={settings.defaultPreset}
              onChange={(e) => void save({ defaultPreset: e.target.value as SmartFlowPreset })}
              disabled={saving}
              className={selectClass}
            >
              {PRESET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="size-4 text-emerald-500" />
            AI Budget
          </CardTitle>
          <CardDescription>Spending caps for AI-powered analysis within SmartFlow.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs">Daily Budget (USD)</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              className="h-8 text-xs"
              value={settings.aiBudgetDailyUsd}
              onChange={(e) => void save({ aiBudgetDailyUsd: parseFloat(e.target.value) || 0 })}
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
              value={settings.aiBudgetMonthlyUsd}
              onChange={(e) => void save({ aiBudgetMonthlyUsd: parseFloat(e.target.value) || 0 })}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-amber-500" />
            Spread Protection
          </CardTitle>
          <CardDescription>Block entries when spread exceeds safe thresholds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm">Spread Protection</p>
              <p className="text-muted-foreground text-xs">Reject trades when spread is too wide</p>
            </div>
            <ToggleSwitch
              checked={settings.spreadProtectionEnabled}
              onChange={(v) => void save({ spreadProtectionEnabled: v })}
              disabled={saving}
            />
          </div>
          {settings.spreadProtectionEnabled && (
            <div className="space-y-2">
              <Label className="text-xs">Max Spread Multiple</Label>
              <p className="text-muted-foreground text-[11px]">
                Reject if current spread exceeds this multiple of the average
              </p>
              <Input
                type="number"
                min={1}
                max={10}
                step={0.5}
                className="h-8 text-xs"
                value={settings.spreadProtectionMultiple}
                onChange={(e) =>
                  void save({ spreadProtectionMultiple: parseFloat(e.target.value) || 2 })
                }
                disabled={saving}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
