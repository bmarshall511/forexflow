"use client"

import type { SfSettingsProps } from "./sf-settings-scanner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { Separator } from "@/components/ui/separator"
import { Shield, AlertTriangle } from "lucide-react"

const INPUT_CLASS = "bg-background h-8 w-16 rounded border px-2 text-right font-mono text-sm"

export function SfSettingsSafety({ settings, onUpdate }: SfSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Daily limits */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-emerald-500" />
            <CardTitle>Daily Limits</CardTitle>
          </div>
          <CardDescription>
            These limits prevent the scanner from placing too many trades in one day. Think of them
            like a spending budget — once you hit the limit, the scanner waits until tomorrow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Trades per Day</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Maximum number of new trades the scanner can place each day
              </p>
            </div>
            <input
              type="number"
              min={1}
              max={20}
              defaultValue={settings.maxDailyAutoTrades}
              onBlur={(e) => {
                const n = parseInt(e.target.value)
                if (!isNaN(n) && n >= 1 && n <= 20) void onUpdate({ maxDailyAutoTrades: n })
              }}
              className={INPUT_CLASS}
              aria-label="Max daily trades"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Trades at Once</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Maximum trades open at the same time. More = more potential profit, but also more
                risk.
              </p>
            </div>
            <input
              type="number"
              min={1}
              max={10}
              defaultValue={settings.maxConcurrentTrades}
              onBlur={(e) => {
                const n = parseInt(e.target.value)
                if (!isNaN(n) && n >= 1 && n <= 10) void onUpdate({ maxConcurrentTrades: n })
              }}
              className={INPUT_CLASS}
              aria-label="Max concurrent trades"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Max Money at Risk</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Stop placing new trades when this much of your balance is being used. Like a
                spending cap — protects you from betting too much at once.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={5}
                max={50}
                step={5}
                defaultValue={settings.maxMarginPercent}
                onBlur={(e) => {
                  const n = parseFloat(e.target.value)
                  if (!isNaN(n) && n >= 5 && n <= 50) void onUpdate({ maxMarginPercent: n })
                }}
                className={INPUT_CLASS}
                aria-label="Max margin percent"
              />
              <span className="text-muted-foreground text-xs">%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Circuit breaker / safety net */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            <CardTitle>Safety Net</CardTitle>
          </div>
          <CardDescription>
            Automatic protection that pauses trading when things go wrong. This is like an emergency
            brake — if you hit a losing streak, SmartFlow stops to protect your money.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Losses in a Row</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                If this many trades lose in a row, pause trading to cool off
              </p>
            </div>
            <input
              type="number"
              min={2}
              max={10}
              defaultValue={settings.circuitBreakerConsecLosses}
              onBlur={(e) => {
                const n = parseInt(e.target.value)
                if (!isNaN(n) && n >= 2 && n <= 10) void onUpdate({ circuitBreakerConsecLosses: n })
              }}
              className={INPUT_CLASS}
              aria-label="Consecutive losses before pause"
            />
          </div>

          <div className="flex items-center justify-between pl-4">
            <div>
              <Label>Pause for</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                How long to wait before trying again (minutes)
              </p>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={30}
                max={480}
                step={30}
                defaultValue={settings.circuitBreakerConsecPause}
                onBlur={(e) => {
                  const n = parseInt(e.target.value)
                  if (!isNaN(n) && n >= 30 && n <= 480)
                    void onUpdate({ circuitBreakerConsecPause: n })
                }}
                className={INPUT_CLASS}
                aria-label="Pause duration in minutes"
              />
              <span className="text-muted-foreground text-xs">min</span>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Daily Loss Limit</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                If this many trades lose today, stop trading until tomorrow
              </p>
            </div>
            <input
              type="number"
              min={2}
              max={20}
              defaultValue={settings.circuitBreakerDailyLosses}
              onBlur={(e) => {
                const n = parseInt(e.target.value)
                if (!isNaN(n) && n >= 2 && n <= 20) void onUpdate({ circuitBreakerDailyLosses: n })
              }}
              className={INPUT_CLASS}
              aria-label="Daily losses before pause"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Max Daily Loss</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                If your account drops by this much today, stop all trading. This is your biggest
                safety net — it prevents a bad day from becoming a disaster.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={10}
                step={0.5}
                defaultValue={settings.circuitBreakerDailyDD}
                onBlur={(e) => {
                  const n = parseFloat(e.target.value)
                  if (!isNaN(n) && n >= 1 && n <= 10) void onUpdate({ circuitBreakerDailyDD: n })
                }}
                className={INPUT_CLASS}
                aria-label="Max daily drawdown percent"
              />
              <span className="text-muted-foreground text-xs">%</span>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
              How it works
            </p>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>
                {settings.circuitBreakerConsecLosses} losses in a row → pause for{" "}
                {settings.circuitBreakerConsecPause} minutes
              </li>
              <li>{settings.circuitBreakerDailyLosses} losses today → stop until tomorrow</li>
              <li>{settings.circuitBreakerDailyDD}% daily loss → stop until tomorrow</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Spread + correlation protection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Extra Protection</CardTitle>
          <CardDescription>
            Additional checks that prevent bad entries and too much risk on similar trades.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Spread Protection</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Don&apos;t enter trades when the cost of trading (spread) is unusually high. This
                happens during news events or quiet market hours.
              </p>
            </div>
            <ToggleSwitch
              checked={settings.spreadProtectionEnabled}
              onChange={(v) => void onUpdate({ spreadProtectionEnabled: v })}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Correlation Warning</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Some currency pairs move together (like EUR/USD and GBP/USD). This prevents you from
                accidentally doubling your risk by trading similar pairs.
              </p>
            </div>
            <ToggleSwitch
              checked={settings.correlationWarningEnabled}
              onChange={(v) => void onUpdate({ correlationWarningEnabled: v })}
            />
          </div>

          {settings.correlationWarningEnabled && (
            <div className="flex items-center justify-between pl-4">
              <div>
                <Label>Max Similar Pairs</Label>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Maximum trades on pairs that move together
                </p>
              </div>
              <input
                type="number"
                min={1}
                max={5}
                defaultValue={settings.maxCorrelatedPairs}
                onBlur={(e) => {
                  const n = parseInt(e.target.value)
                  if (!isNaN(n) && n >= 1 && n <= 5) void onUpdate({ maxCorrelatedPairs: n })
                }}
                className={INPUT_CLASS}
                aria-label="Max correlated pairs"
              />
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>News Protection</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Don&apos;t place trades when a big news event is coming. News can cause wild price
                swings that make trading unpredictable.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={15}
                max={120}
                step={15}
                defaultValue={settings.newsBufferMinutes}
                onBlur={(e) => {
                  const n = parseInt(e.target.value)
                  if (!isNaN(n) && n >= 15 && n <= 120) void onUpdate({ newsBufferMinutes: n })
                }}
                className={INPUT_CLASS}
                aria-label="News buffer minutes"
              />
              <span className="text-muted-foreground text-xs">min before</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
