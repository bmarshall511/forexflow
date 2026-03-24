"use client"

import type { SmartFlowSettingsData, SmartFlowScanMode } from "@fxflow/types"
import { SMART_FLOW_DEFAULT_SCAN_MODES } from "@fxflow/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { Separator } from "@/components/ui/separator"
import { Radar, Info } from "lucide-react"

export interface SfSettingsProps {
  settings: SmartFlowSettingsData
  onUpdate: (fields: Partial<SmartFlowSettingsData>) => Promise<void>
}

const INPUT_CLASS = "bg-background h-8 w-16 rounded border px-2 text-right font-mono text-sm"

const SCAN_MODE_INFO: Record<SmartFlowScanMode, { label: string; desc: string }> = {
  trend_following: {
    label: "Trend Following",
    desc: "Finds trades that go with the market direction — like surfing a wave",
  },
  mean_reversion: {
    label: "Mean Reversion",
    desc: "Finds trades when price stretches too far and is likely to snap back",
  },
  breakout: {
    label: "Breakout",
    desc: "Finds trades when price bursts out of a tight range with momentum",
  },
  session_momentum: {
    label: "Session Momentum",
    desc: "Finds trades during the busiest market hours when big moves happen",
  },
}

export function SfSettingsScanner({ settings, onUpdate }: SfSettingsProps) {
  const modes = settings.scanModes ?? { ...SMART_FLOW_DEFAULT_SCAN_MODES }
  const toggleMode = (m: SmartFlowScanMode) =>
    void onUpdate({ scanModes: { ...modes, [m]: !modes[m] } })

  return (
    <div className="space-y-6">
      {/* Scanner toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Radar className="size-5 text-blue-500" />
            <CardTitle>Find Trades</CardTitle>
          </div>
          <CardDescription>
            The scanner watches the market and looks for good trading opportunities for you. When it
            finds one, it can tell you about it or place the trade automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Scanner</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Turn the scanner on or off. When off, SmartFlow won&apos;t look for new trades.
              </p>
            </div>
            <ToggleSwitch
              checked={settings.scannerEnabled}
              onChange={(v) => void onUpdate({ scannerEnabled: v })}
            />
          </div>

          {settings.scannerEnabled && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>How Often to Scan</Label>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Check the market every this many minutes. Lower = checks more often but uses
                    more resources.
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={5}
                    max={60}
                    step={5}
                    defaultValue={settings.scanIntervalMinutes}
                    onBlur={(e) => {
                      const n = parseInt(e.target.value)
                      if (!isNaN(n) && n >= 5 && n <= 60) void onUpdate({ scanIntervalMinutes: n })
                    }}
                    className={INPUT_CLASS}
                    aria-label="Scan interval in minutes"
                  />
                  <span className="text-muted-foreground text-xs">min</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Scan modes */}
      {settings.scannerEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What to Look For</CardTitle>
            <CardDescription>
              Choose which types of trades the scanner should look for. Each type works differently
              — turning on more types means more opportunities, but some work better in certain
              market conditions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(Object.keys(SCAN_MODE_INFO) as SmartFlowScanMode[]).map((m) => (
                <div key={m} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Label>{SCAN_MODE_INFO[m].label}</Label>
                    <p className="text-muted-foreground mt-0.5 text-xs">{SCAN_MODE_INFO[m].desc}</p>
                  </div>
                  <ToggleSwitch checked={modes[m]} onChange={() => toggleMode(m)} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Simulation mode */}
      {settings.scannerEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Practice Mode</CardTitle>
            <CardDescription>
              Try out the scanner without risking real money. Perfect for learning how it works.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Simulation Mode</Label>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  The scanner will find trades and show you what it would do, but won&apos;t place
                  any real orders. Great for testing your settings before going live.
                </p>
              </div>
              <ToggleSwitch
                checked={settings.shadowMode}
                onChange={(v) => void onUpdate({ shadowMode: v })}
              />
            </div>
            {settings.shadowMode && (
              <div className="flex items-start gap-2 rounded-md bg-blue-500/10 p-3 text-xs text-blue-600 dark:text-blue-400">
                <Info className="mt-0.5 size-4 shrink-0" />
                <span>
                  Simulation is on — the scanner will find opportunities and log them, but no real
                  trades will be placed. You can see what would have happened in the Activity tab.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
