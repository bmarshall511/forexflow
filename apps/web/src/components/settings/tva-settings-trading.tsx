"use client"

import type { TVAlertsConfig } from "@fxflow/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { Separator } from "@/components/ui/separator"
import { Zap, Shield } from "lucide-react"

export interface TVASettingsTradingProps {
  config: TVAlertsConfig
  onUpdate: (partial: Partial<TVAlertsConfig>) => Promise<void>
  saving: boolean
}

const INPUT_CLASS = "bg-background h-8 w-16 rounded border px-2 text-right font-mono text-sm"

export function TVASettingsTrading({ config, onUpdate, saving }: TVASettingsTradingProps) {
  return (
    <div className="space-y-6">
      {/* Module Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-amber-500" />
            <CardTitle>Auto-Trading</CardTitle>
          </div>
          <CardDescription>
            When enabled, incoming UT Bot signals are automatically executed as trades on your OANDA
            account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Module</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {config.enabled
                  ? "Active and processing signals"
                  : "Disabled — signals are ignored"}
              </p>
            </div>
            <ToggleSwitch
              checked={config.enabled}
              onChange={(v) => void onUpdate({ enabled: v })}
              disabled={saving}
            />
          </div>

          <Separator />

          {/* Position sizing */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Position Size</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Percentage of account balance used per trade
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0.1}
                max={100}
                step={0.1}
                defaultValue={config.positionSizePercent}
                onBlur={(e) => {
                  const num = parseFloat(e.target.value)
                  if (!isNaN(num) && num >= 0.1 && num <= 100)
                    void onUpdate({ positionSizePercent: num })
                }}
                className={INPUT_CLASS}
                aria-label="Position size percent"
              />
              <span className="text-muted-foreground text-xs">%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Safety Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-emerald-500" />
            <CardTitle>Safety Controls</CardTitle>
          </div>
          <CardDescription>
            Configure risk limits, cooldowns, and signal filtering safeguards.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cooldown */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Cooldown</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Seconds to wait before accepting another signal on the same pair
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={3600}
                step={1}
                defaultValue={config.cooldownSeconds}
                onBlur={(e) => {
                  const num = parseInt(e.target.value)
                  if (!isNaN(num) && num >= 0) void onUpdate({ cooldownSeconds: num })
                }}
                className={INPUT_CLASS}
                aria-label="Cooldown seconds"
              />
              <span className="text-muted-foreground text-xs">sec</span>
            </div>
          </div>

          <Separator />

          {/* Max positions */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Max Open Positions</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Maximum concurrent auto-trade positions from TV alerts
              </p>
            </div>
            <input
              type="number"
              min={1}
              max={20}
              step={1}
              defaultValue={config.maxOpenPositions}
              onBlur={(e) => {
                const num = parseInt(e.target.value)
                if (!isNaN(num) && num >= 1 && num <= 20) void onUpdate({ maxOpenPositions: num })
              }}
              className={INPUT_CLASS}
              aria-label="Max open positions"
            />
          </div>

          <Separator />

          {/* Daily loss limit */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Daily Loss Limit</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Circuit breaker trips when daily losses exceed this amount (0 = off)
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">$</span>
              <input
                type="number"
                min={0}
                step={1}
                defaultValue={config.dailyLossLimit}
                onBlur={(e) => {
                  const num = parseFloat(e.target.value)
                  if (!isNaN(num) && num >= 0) void onUpdate({ dailyLossLimit: num })
                }}
                className={INPUT_CLASS}
                aria-label="Daily loss limit"
              />
            </div>
          </div>

          <Separator />

          {/* Dedup window */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Dedup Window</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Ignore duplicate signals within this window
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={60}
                step={1}
                defaultValue={config.dedupWindowSeconds}
                onBlur={(e) => {
                  const num = parseInt(e.target.value)
                  if (!isNaN(num) && num >= 1 && num <= 60)
                    void onUpdate({ dedupWindowSeconds: num })
                }}
                className={INPUT_CLASS}
                aria-label="Dedup window seconds"
              />
              <span className="text-muted-foreground text-xs">sec</span>
            </div>
          </div>

          <Separator />

          {/* Market hours filter */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Market Hours Filter</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Only accept signals when the forex market is open
              </p>
            </div>
            <ToggleSwitch
              checked={config.marketHoursFilter}
              onChange={(v) => void onUpdate({ marketHoursFilter: v })}
              disabled={saving}
            />
          </div>

          <Separator />

          {/* Chart markers */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Chart Markers</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Show signal markers on charts by default
              </p>
            </div>
            <ToggleSwitch
              checked={config.showChartMarkers}
              onChange={(v) => void onUpdate({ showChartMarkers: v })}
              disabled={saving}
            />
          </div>

          <Separator />

          {/* Sound */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Sound Notifications</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Play a sound when a new signal is received
              </p>
            </div>
            <ToggleSwitch
              checked={config.soundEnabled}
              onChange={(v) => void onUpdate({ soundEnabled: v })}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
