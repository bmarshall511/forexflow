"use client"

import type { SfSettingsProps } from "./sf-settings-scanner"
import type { SmartFlowOperatingMode, SmartFlowScannerEntryMode } from "@fxflow/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Zap } from "lucide-react"

const INPUT_CLASS = "bg-background h-8 w-16 rounded border px-2 text-right font-mono text-sm"
const SELECT_CLASS =
  "flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring"

const MODE_DESC: Record<SmartFlowOperatingMode, string> = {
  manual: "The scanner finds trades, but you decide which ones to place. Best for learning.",
  semi_auto:
    "The scanner places trades automatically, but only if they score high enough. Good balance of control and convenience.",
  full_auto:
    "The scanner places all qualifying trades automatically. Best when you trust your settings.",
}

const ENTRY_DESC: Record<SmartFlowScannerEntryMode, string> = {
  market:
    "Place the trade immediately at the current price. Fastest, but you might not get the best price.",
  optimal:
    "Wait for price to confirm the trade idea before entering. Slower, but usually gets a better price.",
  smart_entry:
    "Wait for specific conditions you set before entering. Most control, but trades might not trigger.",
}

const PRESET_OPTIONS = [
  {
    value: "auto",
    label: "Auto (let SmartFlow decide)",
    desc: "SmartFlow picks the best strategy based on what the market is doing right now",
  },
  { value: "momentum_catch", label: "Momentum Catch", desc: "Quick in-and-out trades" },
  { value: "steady_growth", label: "Steady Growth", desc: "Balanced approach (recommended)" },
  { value: "swing_capture", label: "Swing Capture", desc: "Bigger moves over days" },
  { value: "trend_rider", label: "Trend Rider", desc: "Ride long trends" },
]

export function SfSettingsAutoTrade({ settings, onUpdate }: SfSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Operating mode */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-teal-500" />
            <CardTitle>How Trades Are Placed</CardTitle>
          </div>
          <CardDescription>
            Choose how much control you want. You can let SmartFlow handle everything, or review
            each trade before it&apos;s placed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Trading Mode</Label>
            <select
              value={settings.operatingMode}
              onChange={(e) =>
                void onUpdate({ operatingMode: e.target.value as SmartFlowOperatingMode })
              }
              className={SELECT_CLASS}
              aria-label="Trading mode"
            >
              <option value="manual">Manual — I&apos;ll approve each trade</option>
              <option value="semi_auto">Semi-Auto — place good trades for me</option>
              <option value="full_auto">Full Auto — place all qualifying trades</option>
            </select>
            <p className="text-muted-foreground text-xs">{MODE_DESC[settings.operatingMode]}</p>
          </div>

          {settings.operatingMode !== "manual" && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                This places real trades with real money. Make sure you understand the risks and have
                set up your safety limits.
              </span>
            </div>
          )}

          {settings.operatingMode === "semi_auto" && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Minimum Score</Label>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Only auto-place trades that score this high or better (0-100). Higher = pickier,
                    fewer trades. Lower = more trades, but riskier.
                  </p>
                </div>
                <input
                  type="number"
                  min={30}
                  max={90}
                  step={5}
                  defaultValue={settings.autoTradeMinScore}
                  onBlur={(e) => {
                    const n = parseInt(e.target.value)
                    if (!isNaN(n) && n >= 30 && n <= 90) void onUpdate({ autoTradeMinScore: n })
                  }}
                  className={INPUT_CLASS}
                  aria-label="Minimum score for auto-trade"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Entry mode + strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entry & Strategy</CardTitle>
          <CardDescription>
            Control how trades are entered and which strategy to use.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>How to Enter Trades</Label>
            <select
              value={settings.scannerEntryMode}
              onChange={(e) =>
                void onUpdate({ scannerEntryMode: e.target.value as SmartFlowScannerEntryMode })
              }
              className={SELECT_CLASS}
              aria-label="Entry mode"
            >
              <option value="market">Market — enter immediately</option>
              <option value="optimal">Optimal — wait for confirmation</option>
              <option value="smart_entry">Smart Entry — wait for conditions</option>
            </select>
            <p className="text-muted-foreground text-xs">{ENTRY_DESC[settings.scannerEntryMode]}</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Trading Strategy</Label>
            <p className="text-muted-foreground mb-1 text-xs">
              This controls how your trades are managed after they&apos;re placed — things like when
              to take profit and how to protect against losses.
            </p>
            <select
              value={settings.preferredPreset}
              onChange={(e) => void onUpdate({ preferredPreset: e.target.value })}
              className={SELECT_CLASS}
              aria-label="Preferred strategy"
            >
              {PRESET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {PRESET_OPTIONS.find((o) => o.value === settings.preferredPreset) && (
              <p className="text-muted-foreground text-[11px] italic">
                {PRESET_OPTIONS.find((o) => o.value === settings.preferredPreset)?.desc}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
