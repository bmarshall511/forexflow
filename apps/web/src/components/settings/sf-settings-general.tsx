"use client"

import type { SfSettingsProps } from "./sf-settings-scanner"
import type { SmartFlowPreset } from "@fxflow/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { Separator } from "@/components/ui/separator"
import { Settings, DollarSign, Info } from "lucide-react"

const INPUT_CLASS = "bg-background h-8 w-16 rounded border px-2 text-right font-mono text-sm"
const SELECT_CLASS =
  "flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring"

const PRESETS: { value: SmartFlowPreset; label: string }[] = [
  { value: "momentum_catch", label: "Momentum Catch — quick trades" },
  { value: "steady_growth", label: "Steady Growth (Recommended)" },
  { value: "swing_capture", label: "Swing Capture — bigger moves" },
  { value: "trend_rider", label: "Trend Rider — ride the wave" },
  { value: "recovery", label: "Recovery Mode (Advanced — higher risk)" },
]

export function SfSettingsGeneral({ settings, onUpdate }: SfSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Master enable */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="size-5 text-blue-500" />
            <CardTitle>SmartFlow</CardTitle>
          </div>
          <CardDescription>
            SmartFlow is your trading assistant. It can find trades, place them, and manage them
            automatically — protecting your money while aiming for profit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable SmartFlow</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Turn SmartFlow on or off. When off, no new trades will be placed and existing trades
                won&apos;t be managed. Your open trades will still be protected by their stop-loss.
              </p>
            </div>
            <ToggleSwitch
              checked={settings.enabled}
              onChange={(v) => void onUpdate({ enabled: v })}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Default Strategy</Label>
            <p className="text-muted-foreground text-xs">
              When you create a new trade plan manually, this strategy is selected by default. Each
              strategy has different risk levels — &quot;Steady Growth&quot; is great for beginners.
            </p>
            <select
              value={settings.defaultPreset}
              onChange={(e) => void onUpdate({ defaultPreset: e.target.value as SmartFlowPreset })}
              className={SELECT_CLASS}
              aria-label="Default strategy"
            >
              {PRESETS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Safety defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Safety Limits</CardTitle>
          <CardDescription>
            Every trade gets these safety limits by default. They protect you from big losses. You
            can change them for individual trades, but these are the starting point.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Max Loss per Trade</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                If a trade loses more than this % of your account, SmartFlow closes it
                automatically. Like an emergency stop — prevents one bad trade from causing major
                damage.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={20}
                step={0.5}
                defaultValue={settings.defaultMaxDrawdownPercent}
                onBlur={(e) => {
                  const n = parseFloat(e.target.value)
                  if (!isNaN(n) && n >= 1 && n <= 20)
                    void onUpdate({ defaultMaxDrawdownPercent: n })
                }}
                className={INPUT_CLASS}
                aria-label="Max drawdown percent"
              />
              <span className="text-muted-foreground text-xs">%</span>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Max Time Open</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Close a trade if it hasn&apos;t finished after this many hours. Prevents trades from
                sitting open forever.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={720}
                defaultValue={settings.defaultMaxHoldHours}
                onBlur={(e) => {
                  const n = parseInt(e.target.value)
                  if (!isNaN(n) && n >= 1 && n <= 720) void onUpdate({ defaultMaxHoldHours: n })
                }}
                className={INPUT_CLASS}
                aria-label="Max hold hours"
              />
              <span className="text-muted-foreground text-xs">hrs</span>
            </div>
          </div>
          <p className="text-muted-foreground pl-1 text-[11px]">
            {settings.defaultMaxHoldHours} hours ={" "}
            {settings.defaultMaxHoldHours >= 24
              ? `~${(settings.defaultMaxHoldHours / 24).toFixed(1)} days`
              : `${settings.defaultMaxHoldHours} hours`}
          </p>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Max Overnight Fees</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                When you hold a trade overnight, your broker charges a small fee. If these fees add
                up past this amount, SmartFlow closes the trade.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-xs">$</span>
              <input
                type="number"
                min={1}
                max={500}
                step={5}
                defaultValue={settings.defaultMaxFinancingUsd}
                onBlur={(e) => {
                  const n = parseFloat(e.target.value)
                  if (!isNaN(n) && n >= 1 && n <= 500) void onUpdate({ defaultMaxFinancingUsd: n })
                }}
                className={INPUT_CLASS}
                aria-label="Max financing cost"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Budget */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="size-5 text-emerald-500" />
            <CardTitle>AI Budget</CardTitle>
          </div>
          <CardDescription>
            SmartFlow can use AI to analyze your trades and suggest improvements. AI costs a small
            amount per use — set a budget to control spending. If you don&apos;t use AI features,
            you can ignore this.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Daily Budget</Label>
              <p className="text-muted-foreground text-xs">
                Max AI spend per day. $1/day is enough for ~50 analyses.
              </p>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-xs">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  defaultValue={settings.aiBudgetDailyUsd}
                  onBlur={(e) => {
                    const n = parseFloat(e.target.value)
                    if (!isNaN(n) && n >= 0) void onUpdate({ aiBudgetDailyUsd: n })
                  }}
                  className={INPUT_CLASS}
                  aria-label="Daily AI budget"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Monthly Budget</Label>
              <p className="text-muted-foreground text-xs">
                Hard cap per month. Once reached, AI pauses until next month.
              </p>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-xs">$</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={settings.aiBudgetMonthlyUsd}
                  onBlur={(e) => {
                    const n = parseFloat(e.target.value)
                    if (!isNaN(n) && n >= 0) void onUpdate({ aiBudgetMonthlyUsd: n })
                  }}
                  className={INPUT_CLASS}
                  aria-label="Monthly AI budget"
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md bg-blue-500/10 p-3 text-xs text-blue-600 dark:text-blue-400">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              AI is optional. SmartFlow works without it — the scanner uses built-in analysis. AI
              adds an extra layer of intelligence for managing open trades.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
