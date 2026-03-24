"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { Zap, DollarSign, ShieldCheck, Info, AlertTriangle } from "lucide-react"
import type { SmartFlowSettingsData, SmartFlowPreset } from "@fxflow/types"
import { SfSettingsScanner } from "./sf-settings-scanner"

const selectClass =
  "flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

const PRESET_OPTIONS: { value: SmartFlowPreset; label: string; desc: string }[] = [
  {
    value: "momentum_catch",
    label: "Momentum Catch",
    desc: "Quick trades that aim for small profits fast. Best if you like checking in often.",
  },
  {
    value: "steady_growth",
    label: "Steady Growth (Recommended)",
    desc: "Balanced approach — protects your money while aiming for solid gains. Great for most people.",
  },
  {
    value: "swing_capture",
    label: "Swing Capture",
    desc: "Goes for bigger wins over several days. Requires patience but can be very rewarding.",
  },
  {
    value: "trend_rider",
    label: "Trend Rider",
    desc: "Rides big market moves with no fixed target. Lets winners run as long as the trend continues.",
  },
  {
    value: "recovery",
    label: "Recovery Mode (Advanced)",
    desc: "Adds to losing trades to lower your average price. Can recover losses but risks are much higher.",
  },
]

function HelpText({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">{children}</p>
}

function InfoCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/50 flex items-start gap-2 rounded-lg p-3">
      <Info className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
      <p className="text-muted-foreground text-[11px] leading-relaxed">{children}</p>
    </div>
  )
}

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
        method: "POST",
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
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="text-primary size-4" />
            General
          </CardTitle>
          <CardDescription>
            Control how SmartFlow works. SmartFlow places and manages trades for you, automatically
            protecting your money and aiming to close every trade in profit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Enable SmartFlow</p>
              <HelpText>
                Turn SmartFlow on or off. When off, no new SmartFlow trades will be placed and
                existing trades won&apos;t be actively managed. Your open trades will still be
                protected by their stop-loss on OANDA.
              </HelpText>
            </div>
            <ToggleSwitch
              checked={settings.enabled}
              onChange={(v) => void save({ enabled: v })}
              disabled={saving}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs font-medium">Max Concurrent Trades</Label>
            <HelpText>
              The maximum number of SmartFlow trades that can be open at the same time. More trades
              means more potential profit, but also more of your money is at risk. If you&apos;re
              just starting out, keep this at 1-3.
            </HelpText>
            <Input
              type="number"
              min={1}
              max={20}
              className="h-8 w-32 text-xs"
              value={settings.maxConcurrentTrades}
              onChange={(e) => void save({ maxConcurrentTrades: parseInt(e.target.value) || 3 })}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Max Margin Usage (%)</Label>
            <HelpText>
              The maximum percentage of your available money that SmartFlow can use for trades.
              Think of it as a spending limit — if you set it to 40%, SmartFlow will never use more
              than 40% of your account balance for trades. This protects you from risking too much
              at once.
            </HelpText>
            <Input
              type="number"
              min={5}
              max={90}
              step={5}
              className="h-8 w-32 text-xs"
              value={settings.maxMarginPercent}
              onChange={(e) => void save({ maxMarginPercent: parseFloat(e.target.value) || 40 })}
              disabled={saving}
            />
            <InfoCallout>
              A lower percentage is safer. Most professional traders use 20-40%. Setting this too
              high could put your entire account at risk if multiple trades go against you.
            </InfoCallout>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs font-medium">Default Strategy</Label>
            <HelpText>
              When you create a new trade, this strategy will be selected by default. You can always
              change it per trade. Each strategy has different risk levels and timeframes.
            </HelpText>
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
            {PRESET_OPTIONS.find((o) => o.value === settings.defaultPreset) && (
              <p className="text-muted-foreground text-[11px] italic">
                {PRESET_OPTIONS.find((o) => o.value === settings.defaultPreset)?.desc}
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Correlation Warnings</p>
                <HelpText>
                  Some currency pairs move together (like EUR/USD and GBP/USD). If you have trades
                  on both, you&apos;re basically doubling your risk. When enabled, SmartFlow will
                  warn you before opening trades on pairs that move in the same direction.
                </HelpText>
              </div>
              <ToggleSwitch
                checked={settings.correlationWarningEnabled}
                onChange={(v) => void save({ correlationWarningEnabled: v })}
                disabled={saving}
              />
            </div>
            {settings.correlationWarningEnabled && (
              <div className="space-y-2 pl-1">
                <Label className="text-xs font-medium">Max Correlated Pairs</Label>
                <HelpText>
                  How many similar (correlated) pairs SmartFlow can trade at the same time. For
                  example, if set to 2, you could have trades on EUR/USD and EUR/GBP, but SmartFlow
                  would block a third EUR-related trade.
                </HelpText>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  className="h-8 w-32 text-xs"
                  value={settings.maxCorrelatedPairs}
                  onChange={(e) => void save({ maxCorrelatedPairs: parseInt(e.target.value) || 2 })}
                  disabled={saving}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Market Scanner */}
      <SfSettingsScanner settings={settings} onUpdate={save} />

      {/* Safety Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-amber-500" />
            Safety Defaults
          </CardTitle>
          <CardDescription>
            These are the default safety limits for every new SmartFlow trade. They protect you from
            large losses. You can customize them per trade, but these defaults apply unless you
            change them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Max Drawdown (%)</Label>
            <HelpText>
              If a trade loses more than this percentage of your account, SmartFlow will
              automatically close it. Think of this as an emergency stop — it prevents a single bad
              trade from causing major damage to your account.
            </HelpText>
            <Input
              type="number"
              min={1}
              max={20}
              step={0.5}
              className="h-8 w-32 text-xs"
              value={settings.defaultMaxDrawdownPercent}
              onChange={(e) =>
                void save({ defaultMaxDrawdownPercent: parseFloat(e.target.value) || 5 })
              }
              disabled={saving}
            />
            <InfoCallout>
              Professional traders typically risk 1-5% per trade. If you set this to 5%, and your
              account is $10,000, SmartFlow will close the trade if it loses $500.
            </InfoCallout>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Max Hold Time (hours)</Label>
            <HelpText>
              The longest time a SmartFlow trade can stay open. If a trade hasn&apos;t reached its
              target or been closed by other rules after this time, SmartFlow will close it. This
              prevents trades from sitting open forever.
            </HelpText>
            <Input
              type="number"
              min={1}
              max={720}
              className="h-8 w-32 text-xs"
              value={settings.defaultMaxHoldHours}
              onChange={(e) => void save({ defaultMaxHoldHours: parseInt(e.target.value) || 168 })}
              disabled={saving}
            />
            <p className="text-muted-foreground text-[11px]">
              {settings.defaultMaxHoldHours} hours ={" "}
              {settings.defaultMaxHoldHours >= 24
                ? `~${(settings.defaultMaxHoldHours / 24).toFixed(1)} days`
                : `${settings.defaultMaxHoldHours} hours`}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Max Overnight Fees ($)</Label>
            <HelpText>
              When you hold a trade overnight, your broker charges a small fee called a
              &quot;swap&quot; or &quot;financing&quot; cost. If these fees add up to more than this
              amount, SmartFlow will close the trade. This prevents slow-burning costs from eating
              your profits.
            </HelpText>
            <Input
              type="number"
              min={1}
              max={500}
              step={5}
              className="h-8 w-32 text-xs"
              value={settings.defaultMaxFinancingUsd}
              onChange={(e) =>
                void save({ defaultMaxFinancingUsd: parseFloat(e.target.value) || 50 })
              }
              disabled={saving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Spread Protection</p>
              <HelpText>
                The &quot;spread&quot; is the difference between the buy and sell price — it&apos;s
                like a small fee you pay on every trade. Sometimes spreads get very wide (during
                news events or low-activity hours), which means you&apos;d pay a lot more. When
                enabled, SmartFlow won&apos;t enter trades when the spread is unusually high.
              </HelpText>
            </div>
            <ToggleSwitch
              checked={settings.spreadProtectionEnabled}
              onChange={(v) => void save({ spreadProtectionEnabled: v })}
              disabled={saving}
            />
          </div>
          {settings.spreadProtectionEnabled && (
            <div className="space-y-2 pl-1">
              <Label className="text-xs font-medium">Spread Trigger Multiple</Label>
              <HelpText>
                SmartFlow tracks the normal spread for each currency pair. If the current spread
                jumps to more than this multiple of the normal spread, SmartFlow will wait before
                entering a trade. For example, if the normal spread is 1.5 pips and you set this to
                3x, SmartFlow will block entries when the spread exceeds 4.5 pips.
              </HelpText>
              <Input
                type="number"
                min={1.5}
                max={10}
                step={0.5}
                className="h-8 w-32 text-xs"
                value={settings.spreadProtectionMultiple}
                onChange={(e) =>
                  void save({ spreadProtectionMultiple: parseFloat(e.target.value) || 3 })
                }
                disabled={saving}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Budget */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="size-4 text-emerald-500" />
            AI Budget
          </CardTitle>
          <CardDescription>
            SmartFlow can optionally use AI (Claude) to analyze your trades and suggest
            improvements. AI costs money per use, so set a budget to control spending. If you
            don&apos;t plan to use AI features, you can leave these at their defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Daily Budget (USD)</Label>
              <HelpText>
                Maximum AI spend per day. Each AI analysis costs a few cents. $1/day is enough for
                ~50 analyses using the fast model.
              </HelpText>
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
              <Label className="text-xs font-medium">Monthly Budget (USD)</Label>
              <HelpText>
                Maximum AI spend per month. This is a hard cap — once reached, AI features pause
                until next month.
              </HelpText>
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
          </div>
        </CardContent>
      </Card>

      {/* Recovery Mode Warning */}
      <div className="overflow-hidden rounded-lg border border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/30">
        <div className="flex items-start gap-3 p-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <div className="min-w-0 space-y-2">
            <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              About Recovery Mode
            </h4>
            <p className="text-xs leading-relaxed text-amber-900/70 dark:text-amber-200/70">
              Recovery Mode is an advanced strategy that adds to losing trades to lower your average
              entry price. While it can help recover losses, it{" "}
              <strong className="font-semibold text-amber-900 dark:text-amber-100">
                significantly increases risk
              </strong>{" "}
              because you&apos;re putting more money into a trade that&apos;s already losing.
            </p>
            <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-2.5 dark:bg-amber-500/5">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-[11px] font-medium leading-relaxed text-amber-800 dark:text-amber-200">
                Only use Recovery Mode if you fully understand the risks and have a large enough
                account to handle multiple losing levels. Your maximum possible loss is much larger
                than with other strategies.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
