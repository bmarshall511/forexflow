"use client"

import { useState, useCallback } from "react"
import type { TradeFinderPairConfig, TradeFinderTimeframeSet } from "@fxflow/types"
import { FOREX_PAIR_GROUPS, formatInstrument } from "@fxflow/shared"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useTradeFinderConfig } from "@/hooks/use-trade-finder-config"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { AlertTriangle, Zap } from "lucide-react"

const TF_SET_OPTIONS: { value: TradeFinderTimeframeSet; label: string; desc: string }[] = [
  { value: "hourly", label: "Hourly", desc: "H1 / M15 / M5" },
  { value: "daily", label: "Daily", desc: "D / H1 / M15" },
  { value: "weekly", label: "Weekly", desc: "W / D / H1" },
  { value: "monthly", label: "Monthly", desc: "M / W / D" },
]

export function TradeFinderSettingsPage() {
  const { config, isLoading, update } = useTradeFinderConfig()
  const [saving, setSaving] = useState(false)
  const [cancellingAuto, setCancellingAuto] = useState(false)

  const handleUpdate = useCallback(
    async (partial: Parameters<typeof update>[0]) => {
      setSaving(true)
      try {
        await update(partial)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed")
      } finally {
        setSaving(false)
      }
    },
    [update],
  )

  const handleCancelAllAuto = useCallback(async () => {
    setCancellingAuto(true)
    try {
      const res = await fetch("/api/trade-finder/cancel-auto", { method: "POST" })
      const json = await res.json()
      if (json.ok) {
        toast.success(`Cancelled ${json.data.cancelled} auto-placed order(s)`)
      } else {
        toast.error(json.error ?? "Failed to cancel")
      }
    } catch {
      toast.error("Failed to cancel auto-placed orders")
    } finally {
      setCancellingAuto(false)
    }
  }, [])

  if (isLoading || !config) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
  }

  const pairs = config.pairs
  const enabledCount = pairs.filter((p) => p.enabled).length
  const autoTradeEnabledPairCount = pairs.filter((p) => p.enabled && p.autoTradeEnabled !== false).length

  const getPairConfig = (instrument: string): TradeFinderPairConfig | undefined =>
    pairs.find((p) => p.instrument === instrument)

  const togglePair = async (instrument: string) => {
    const existing = getPairConfig(instrument)
    let newPairs: TradeFinderPairConfig[]

    if (existing) {
      newPairs = pairs.map((p) =>
        p.instrument === instrument ? { ...p, enabled: !p.enabled } : p,
      )
    } else {
      if (enabledCount >= config.maxEnabledPairs) {
        toast.error(`Maximum ${config.maxEnabledPairs} pairs allowed`)
        return
      }
      newPairs = [...pairs, { instrument, enabled: true, timeframeSet: "daily" as TradeFinderTimeframeSet }]
    }

    await handleUpdate({ pairs: newPairs })
  }

  const togglePairAutoTrade = async (instrument: string) => {
    const newPairs = pairs.map((p) =>
      p.instrument === instrument ? { ...p, autoTradeEnabled: !(p.autoTradeEnabled !== false) } : p,
    )
    await handleUpdate({ pairs: newPairs })
  }

  const changeTfSet = async (instrument: string, timeframeSet: TradeFinderTimeframeSet) => {
    const newPairs = pairs.map((p) =>
      p.instrument === instrument ? { ...p, timeframeSet } : p,
    )
    await handleUpdate({ pairs: newPairs })
  }

  const handleMinScoreChange = async (value: string) => {
    const num = parseFloat(value)
    if (isNaN(num) || num < 1 || num > 12) return
    await handleUpdate({ minScore: num })
  }

  const handleAutoTradeMinScoreChange = async (value: string) => {
    const num = parseFloat(value)
    if (isNaN(num) || num < 1 || num > 12) return
    await handleUpdate({ autoTradeMinScore: num })
  }

  const handleAutoTradeMaxConcurrentChange = async (value: string) => {
    const num = parseInt(value)
    if (isNaN(num) || num < 1 || num > 20) return
    await handleUpdate({ autoTradeMaxConcurrent: num })
  }

  const handleAutoTradeMaxDailyChange = async (value: string) => {
    const num = parseInt(value)
    if (isNaN(num) || num < 1 || num > 50) return
    await handleUpdate({ autoTradeMaxDaily: num })
  }

  const handleAutoTradeMaxRiskChange = async (value: string) => {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0.5 || num > 50) return
    await handleUpdate({ autoTradeMaxRiskPercent: num })
  }

  const handleAutoTradeMinRRChange = async (value: string) => {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0.5 || num > 10) return
    await handleUpdate({ autoTradeMinRR: num })
  }

  return (
    <div className="space-y-6">
      {/* Scanner Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Trade Finder</CardTitle>
          <CardDescription>
            Multi-timeframe scanner for high-probability trade setups using the 7 Odds Enhancers scoring system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <Label>Scanner</Label>
            <Button
              variant={config.enabled ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs min-w-[80px]"
              onClick={() => handleUpdate({ enabled: !config.enabled })}
              disabled={saving}
            >
              {config.enabled ? "Enabled" : "Disabled"}
            </Button>
          </div>

          {/* Min score */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Minimum Score</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Only show setups scoring at or above this threshold (max 12)
              </p>
            </div>
            <input
              type="number"
              min={1}
              max={12}
              step={0.5}
              defaultValue={config.minScore}
              onBlur={(e) => handleMinScoreChange(e.target.value)}
              className="w-16 h-8 text-sm px-2 border rounded bg-background text-right font-mono"
            />
          </div>

          {/* Max enabled pairs */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Max Enabled Pairs</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Maximum number of pairs to scan simultaneously
              </p>
            </div>
            <input
              type="number"
              min={1}
              max={30}
              step={1}
              defaultValue={config.maxEnabledPairs}
              onBlur={(e) => {
                const num = parseInt(e.target.value)
                if (!isNaN(num) && num >= 1 && num <= 30) {
                  void handleUpdate({ maxEnabledPairs: num })
                }
              }}
              className="w-16 h-8 text-sm px-2 border rounded bg-background text-right font-mono"
            />
          </div>

          {/* Risk percent */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Risk % per Trade</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configured in global settings (shared with TV Alerts)
              </p>
            </div>
            <span className="text-sm font-mono text-muted-foreground">{config.riskPercent}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Trade Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-teal-500" />
            <CardTitle>Auto-Trade</CardTitle>
          </div>
          <CardDescription>
            Automatically place limit orders for setups that meet your score threshold. Orders are placed as LIMIT orders only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Master toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Trade</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {config.autoTradeEnabled
                  ? `Active on ${autoTradeEnabledPairCount} pair(s)`
                  : "Disabled — setups are shown but not automatically placed"}
              </p>
            </div>
            <Button
              variant={config.autoTradeEnabled ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-8 text-xs min-w-[80px]",
                config.autoTradeEnabled && "bg-teal-600 hover:bg-teal-700 text-white",
              )}
              onClick={() => handleUpdate({ autoTradeEnabled: !config.autoTradeEnabled })}
              disabled={saving}
            >
              {config.autoTradeEnabled ? "Enabled" : "Disabled"}
            </Button>
          </div>

          {config.autoTradeEnabled && (
            <>
              {/* Warning */}
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>
                  Auto-trade places real orders with real money. Make sure you understand the risks. Orders are always placed as LIMIT orders — never market orders.
                </span>
              </div>

              {/* Auto-trade min score */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Trade Minimum Score</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Only auto-trade setups scoring at or above this (max 12)
                  </p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={12}
                  step={0.5}
                  defaultValue={config.autoTradeMinScore}
                  onBlur={(e) => handleAutoTradeMinScoreChange(e.target.value)}
                  className="w-16 h-8 text-sm px-2 border rounded bg-background text-right font-mono"
                />
              </div>

              {/* Max concurrent */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Max Concurrent Auto-Orders</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Maximum pending auto-placed orders at once
                  </p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  defaultValue={config.autoTradeMaxConcurrent}
                  onBlur={(e) => handleAutoTradeMaxConcurrentChange(e.target.value)}
                  className="w-16 h-8 text-sm px-2 border rounded bg-background text-right font-mono"
                />
              </div>

              {/* Max daily */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Max Daily Auto-Trades</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Maximum auto-trades in a 24-hour window
                  </p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  defaultValue={config.autoTradeMaxDaily}
                  onBlur={(e) => handleAutoTradeMaxDailyChange(e.target.value)}
                  className="w-16 h-8 text-sm px-2 border rounded bg-background text-right font-mono"
                />
              </div>

              {/* Max total risk */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Max Total Risk %</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Stop auto-trading if total risk across auto-orders exceeds this % of balance
                  </p>
                </div>
                <input
                  type="number"
                  min={0.5}
                  max={50}
                  step={0.5}
                  defaultValue={config.autoTradeMaxRiskPercent}
                  onBlur={(e) => handleAutoTradeMaxRiskChange(e.target.value)}
                  className="w-16 h-8 text-sm px-2 border rounded bg-background text-right font-mono"
                />
              </div>

              {/* Minimum R:R */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Minimum Risk:Reward</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Only auto-trade setups with at least this R:R ratio (e.g. 2 = 2:1)
                  </p>
                </div>
                <input
                  type="number"
                  min={0.5}
                  max={10}
                  step={0.5}
                  defaultValue={config.autoTradeMinRR}
                  onBlur={(e) => handleAutoTradeMinRRChange(e.target.value)}
                  className="w-16 h-8 text-sm px-2 border rounded bg-background text-right font-mono"
                />
              </div>

              {/* Cancel on invalidation */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Cancel on Zone Invalidation</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cancel pending auto-placed orders when the zone is broken
                  </p>
                </div>
                <Button
                  variant={config.autoTradeCancelOnInvalidation ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs min-w-[80px]"
                  onClick={() => handleUpdate({ autoTradeCancelOnInvalidation: !config.autoTradeCancelOnInvalidation })}
                  disabled={saving}
                >
                  {config.autoTradeCancelOnInvalidation ? "Enabled" : "Disabled"}
                </Button>
              </div>

              {/* Cancel all auto-placed */}
              <div className="pt-2 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleCancelAllAuto}
                  disabled={cancellingAuto}
                >
                  {cancellingAuto ? "Cancelling..." : "Cancel All Auto-Placed Orders"}
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Cancels all currently pending auto-placed limit orders on OANDA
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pair Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Pairs to Scan</CardTitle>
          <CardDescription>
            Toggle pairs on/off and set the timeframe set for each. {enabledCount}/{config.maxEnabledPairs} enabled.
            {config.autoTradeEnabled && ` ${autoTradeEnabledPairCount} pair(s) have auto-trade enabled.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {FOREX_PAIR_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {group.label}
              </h3>
              <div className="space-y-0.5">
                {group.pairs.map((fp) => {
                  const pairConfig = getPairConfig(fp.value)
                  const isEnabled = pairConfig?.enabled ?? false
                  const isAdded = !!pairConfig
                  const atLimit = enabledCount >= config.maxEnabledPairs && !isEnabled
                  const pairAutoTrade = pairConfig?.autoTradeEnabled !== false

                  return (
                    <div
                      key={fp.value}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                        isEnabled ? "bg-accent/50" : "hover:bg-muted/50",
                      )}
                    >
                      {/* Toggle checkbox */}
                      <button
                        onClick={() => togglePair(fp.value)}
                        disabled={atLimit && !isEnabled}
                        className={cn(
                          "size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                          isEnabled
                            ? "bg-primary border-primary text-primary-foreground"
                            : atLimit
                              ? "border-muted-foreground/30 cursor-not-allowed"
                              : "border-muted-foreground hover:border-primary",
                        )}
                        aria-label={`Toggle ${fp.label}`}
                      >
                        {isEnabled && (
                          <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 6l3 3 5-5" />
                          </svg>
                        )}
                      </button>

                      {/* Pair label */}
                      <span
                        className={cn(
                          "text-sm font-mono flex-1",
                          isEnabled ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {fp.label}
                      </span>

                      {/* Auto-trade badge (only when enabled + auto-trade is globally on) */}
                      {isEnabled && config.autoTradeEnabled && (
                        <button
                          onClick={() => togglePairAutoTrade(fp.value)}
                          className={cn(
                            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors",
                            pairAutoTrade
                              ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20"
                              : "text-muted-foreground border-transparent hover:border-border",
                          )}
                          aria-label={`Toggle auto-trade for ${fp.label}`}
                        >
                          <Zap className="size-3" />
                          {pairAutoTrade ? "Auto" : "Manual"}
                        </button>
                      )}

                      {/* Timeframe set selector (only shown when added) */}
                      {isAdded && (
                        <select
                          className="h-7 text-xs px-1.5 border rounded bg-background"
                          value={pairConfig!.timeframeSet}
                          onChange={(e) => changeTfSet(fp.value, e.target.value as TradeFinderTimeframeSet)}
                          aria-label={`Timeframe set for ${fp.label}`}
                        >
                          {TF_SET_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label} ({opt.desc})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
