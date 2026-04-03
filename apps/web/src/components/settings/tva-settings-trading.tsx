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
            When turned on, trading signals from TradingView are automatically placed as real trades
            on your OANDA account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Module</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {config.enabled
                  ? "On — signals will be placed as trades"
                  : "Off — signals are received but no trades are placed"}
              </p>
            </div>
            <ToggleSwitch
              checked={config.enabled}
              onChange={(v) => void onUpdate({ enabled: v })}
              disabled={saving}
            />
          </div>

          <Separator />

          {/* Risk per trade */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Risk Per Trade</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                How much of your account you&apos;re willing to lose on a single trade.
                <br />
                1% means if you have $10,000, you&apos;d risk $100 per trade.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0.1}
                max={10}
                step={0.1}
                defaultValue={config.riskPercent}
                onBlur={(e) => {
                  const num = parseFloat(e.target.value)
                  if (!isNaN(num) && num >= 0.1 && num <= 10) void onUpdate({ riskPercent: num })
                }}
                className={INPUT_CLASS}
                aria-label="Risk percent per trade"
              />
              <span className="text-muted-foreground text-xs">%</span>
            </div>
          </div>

          <Separator />

          {/* Minimum position size */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Minimum Trade Size</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Smallest trade the app will place. If the math says to trade less
                <br />
                than this, the signal is skipped. 1,000 = 0.01 lots (micro lot).
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={1000000}
                step={1000}
                defaultValue={config.minUnits}
                onBlur={(e) => {
                  const num = parseInt(e.target.value)
                  if (!isNaN(num) && num >= 1 && num <= 1_000_000) void onUpdate({ minUnits: num })
                }}
                className="bg-background h-8 w-24 rounded border px-2 text-right font-mono text-sm"
                aria-label="Minimum trade size in units"
              />
              <span className="text-muted-foreground text-xs">units</span>
            </div>
          </div>

          <Separator />

          {/* ATR multiplier for risk sizing */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Risk Distance (ATR)</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Controls how far away the app assumes your stop loss is when calculating trade size.
                Higher = wider stop = smaller trade size.
                <br />
                1.5 means 1.5x the average price movement.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0.5}
                max={5}
                step={0.1}
                defaultValue={config.fallbackAtrMultiplier}
                onBlur={(e) => {
                  const num = parseFloat(e.target.value)
                  if (!isNaN(num) && num >= 0.5 && num <= 5)
                    void onUpdate({ fallbackAtrMultiplier: num })
                }}
                className={INPUT_CLASS}
                aria-label="ATR multiplier for risk calculation"
              />
              <span className="text-muted-foreground text-xs">&times; ATR</span>
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
            Rules that protect your account from too many trades or big losses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cooldown */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Cooldown</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                After a trade is placed, wait this many seconds before allowing another trade on the
                same currency pair. Prevents rapid-fire trades.
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
                The most trades that can be open at the same time from alerts. New signals are
                skipped if you&apos;re already at this limit.
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
                If your losses for the day hit this dollar amount, all new trades are blocked until
                tomorrow. Set to 0 to turn this off.
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
              <Label>Duplicate Filter</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                If the same signal arrives twice within this many seconds, the second one is
                ignored. Prevents accidental double trades.
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
                When on, signals that arrive on weekends or when the market is closed are
                automatically ignored.
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
                Show buy/sell arrows on your charts when signals come in, so you can see exactly
                where each trade was triggered.
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
                Play a notification sound whenever a new trading signal arrives.
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
