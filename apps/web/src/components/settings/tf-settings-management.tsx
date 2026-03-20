"use client"

import type { TFSettingsProps } from "./tf-settings-scanner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Shield } from "lucide-react"

const INPUT_CLASS = "bg-background h-8 w-16 rounded border px-2 text-right font-mono text-sm"

export function TFSettingsManagement({ config, onUpdate, saving }: TFSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-emerald-500" />
          <CardTitle>After You&apos;re In a Trade</CardTitle>
        </div>
        <CardDescription>
          Manage open trades to protect profits and cut losses.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Breakeven */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Protect Your Money</Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Once the trade is going well, move your safety net so you can&apos;t lose money
              on it.
            </p>
          </div>
          <ToggleSwitch
            checked={config.breakevenEnabled}
            onChange={(v) => void onUpdate({ breakevenEnabled: v })}
            disabled={saving}
          />
        </div>

        <Separator />

        {/* Partial close */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Take Some Profit Early</Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Close part of your trade to lock in some gains.
            </p>
          </div>
          <ToggleSwitch
            checked={config.partialCloseEnabled}
            onChange={(v) => void onUpdate({ partialCloseEnabled: v })}
            disabled={saving}
          />
        </div>

        {config.partialCloseEnabled && (
          <div className="space-y-4 pl-4">
            {/* Strategy select */}
            <div className="flex items-center justify-between">
              <Label>Exit Strategy</Label>
              <Select
                value={config.partialExitStrategy}
                onValueChange={(v) =>
                  void onUpdate({ partialExitStrategy: v as "standard" | "thirds" })
                }
              >
                <SelectTrigger className="w-44" aria-label="Partial exit strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (close half)</SelectItem>
                  <SelectItem value="thirds">Thirds (close in 3 stages)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.partialExitStrategy === "standard" && (
              <div className="flex items-center justify-between">
                <div>
                  <Label>Close %</Label>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    What percentage to close
                  </p>
                </div>
                <input
                  type="number"
                  min={10} max={90} step={10}
                  defaultValue={config.partialClosePercent}
                  onBlur={(e) => {
                    const num = parseFloat(e.target.value)
                    if (!isNaN(num) && num >= 10 && num <= 90)
                      void onUpdate({ partialClosePercent: num })
                  }}
                  className={INPUT_CLASS}
                  aria-label="Partial close percentage"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label>Profit target</Label>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Take profit when trade reaches this target
                </p>
              </div>
              <input
                type="number"
                min={0.5} max={10} step={0.5}
                defaultValue={config.partialCloseRR}
                onBlur={(e) => {
                  const num = parseFloat(e.target.value)
                  if (!isNaN(num) && num >= 0.5 && num <= 10)
                    void onUpdate({ partialCloseRR: num })
                }}
                className={INPUT_CLASS}
                aria-label="Partial close profit target"
              />
            </div>
          </div>
        )}

        <Separator />
        <TrailingAndTimeExit config={config} onUpdate={onUpdate} saving={saving} />
      </CardContent>
    </Card>
  )
}

/* Extracted to keep TFSettingsManagement under 150 LOC */
function TrailingAndTimeExit({ config, onUpdate, saving }: TFSettingsProps) {
  return (
    <>
      {/* Trailing stop */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Lock In Profits</Label>
          <p className="text-muted-foreground mt-0.5 text-xs">
            As the price keeps moving in your favor, keep raising your safety net to protect
            more profit.
          </p>
        </div>
        <ToggleSwitch
          checked={config.trailingStopEnabled}
          onChange={(v) => void onUpdate({ trailingStopEnabled: v })}
          disabled={saving}
        />
      </div>

      {config.trailingStopEnabled && (
        <div className="flex items-center justify-between pl-4">
          <div>
            <Label>Trail behind</Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Number of candles to trail behind
            </p>
          </div>
          <input
            type="number"
            min={1} max={20} step={1}
            defaultValue={config.trailingStopCandles}
            onBlur={(e) => {
              const num = parseInt(e.target.value)
              if (!isNaN(num) && num >= 1 && num <= 20)
                void onUpdate({ trailingStopCandles: num })
            }}
            className={INPUT_CLASS}
            aria-label="Trailing stop candles"
          />
        </div>
      )}

      <Separator />

      {/* Time exit */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Close Slow Trades</Label>
          <p className="text-muted-foreground mt-0.5 text-xs">
            If a trade isn&apos;t going anywhere, close it and move on.
          </p>
        </div>
        <ToggleSwitch
          checked={config.timeExitEnabled}
          onChange={(v) => void onUpdate({ timeExitEnabled: v })}
          disabled={saving}
        />
      </div>

      {config.timeExitEnabled && (
        <div className="flex items-center justify-between pl-4">
          <div>
            <Label>Close after</Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Close after this many candles with no progress
            </p>
          </div>
          <input
            type="number"
            min={5} max={100} step={5}
            defaultValue={config.timeExitCandles}
            onBlur={(e) => {
              const num = parseInt(e.target.value)
              if (!isNaN(num) && num >= 5 && num <= 100)
                void onUpdate({ timeExitCandles: num })
            }}
            className={INPUT_CLASS}
            aria-label="Time exit candles"
          />
        </div>
      )}
    </>
  )
}
