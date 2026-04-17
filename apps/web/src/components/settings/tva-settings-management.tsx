"use client"

import { useCallback, useState } from "react"
import { useTVAlertsManagementConfig } from "@/hooks/use-tv-alerts-management-config"
import type { TVAlertsManagementConfig } from "@fxflow/types"
import { TV_ALERTS_MANAGEMENT_DEFAULTS } from "@fxflow/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { TrendingUp, ArrowDownRight, Scissors, Clock, AlertTriangle } from "lucide-react"

const INPUT_CLASS = "bg-background h-8 w-16 rounded border px-2 text-right font-mono text-sm"

export function TVASettingsManagement() {
  const { config, isLoading, update } = useTVAlertsManagementConfig()
  const [saving, setSaving] = useState(false)

  const data = config ?? TV_ALERTS_MANAGEMENT_DEFAULTS

  const handleUpdate = useCallback(
    async (partial: Partial<TVAlertsManagementConfig>) => {
      setSaving(true)
      try {
        await update(partial)
        toast.success("Management settings saved")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed")
      } finally {
        setSaving(false)
      }
    },
    [update],
  )

  if (isLoading) {
    return <div className="text-muted-foreground py-12 text-center text-sm">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Breakeven */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-green-500" />
            <CardTitle>Breakeven</CardTitle>
          </div>
          <CardDescription>
            Automatically move the stop loss to entry price (plus a buffer) once the trade reaches a
            profit target. Locks in a risk-free position.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enable breakeven</Label>
            <ToggleSwitch
              checked={data.breakevenEnabled}
              onChange={(v) => void handleUpdate({ breakevenEnabled: v })}
              disabled={saving}
            />
          </div>
          {data.breakevenEnabled && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Trigger at R:R</Label>
                  <p className="text-muted-foreground text-xs">
                    Move SL to breakeven when profit reaches this multiple of risk
                  </p>
                </div>
                <input
                  type="number"
                  className={INPUT_CLASS}
                  defaultValue={data.breakevenRR}
                  min={0.5}
                  max={5}
                  step={0.1}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v) && v >= 0.5 && v <= 5) void handleUpdate({ breakevenRR: v })
                  }}
                  disabled={saving}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Buffer (pips)</Label>
                  <p className="text-muted-foreground text-xs">
                    Pips beyond entry for the new SL (prevents stop-out from spread noise)
                  </p>
                </div>
                <input
                  type="number"
                  className={INPUT_CLASS}
                  defaultValue={data.breakevenBufferPips}
                  min={0}
                  max={10}
                  step={0.5}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v) && v >= 0 && v <= 10)
                      void handleUpdate({ breakevenBufferPips: v })
                  }}
                  disabled={saving}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Trailing Stop */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowDownRight className="size-5 text-blue-500" />
            <CardTitle>Trailing Stop</CardTitle>
          </div>
          <CardDescription>
            After breakeven fires, trail the stop loss behind price using an ATR-based distance.
            Locks in more profit as the trade moves further in your favor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enable trailing stop</Label>
            <ToggleSwitch
              checked={data.trailingEnabled}
              onChange={(v) => void handleUpdate({ trailingEnabled: v })}
              disabled={saving}
            />
          </div>
          {data.trailingEnabled && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Trail distance (ATR multiple)</Label>
                  <p className="text-muted-foreground text-xs">
                    SL trails behind current price by ATR x this value
                  </p>
                </div>
                <input
                  type="number"
                  className={INPUT_CLASS}
                  defaultValue={data.trailingAtrMultiple}
                  min={0.5}
                  max={5}
                  step={0.1}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v) && v >= 0.5 && v <= 5)
                      void handleUpdate({ trailingAtrMultiple: v })
                  }}
                  disabled={saving}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Partial Close */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Scissors className="size-5 text-purple-500" />
            <CardTitle>Partial Close</CardTitle>
          </div>
          <CardDescription>
            Take profit on portions of the position at predefined targets. Reduces risk while
            keeping exposure to further upside.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enable partial close</Label>
            <ToggleSwitch
              checked={data.partialCloseEnabled}
              onChange={(v) => void handleUpdate({ partialCloseEnabled: v })}
              disabled={saving}
            />
          </div>
          {data.partialCloseEnabled && (
            <div className="flex items-center justify-between">
              <div>
                <Label>Strategy</Label>
                <p className="text-muted-foreground text-xs">
                  Thirds: close 33% at 1:1 R:R, 33% at 2:1 R:R. Standard: close a custom %.
                </p>
              </div>
              <select
                className="bg-background h-8 rounded border px-2 text-sm"
                value={data.partialCloseStrategy}
                onChange={(e) =>
                  void handleUpdate({
                    partialCloseStrategy: e.target
                      .value as TVAlertsManagementConfig["partialCloseStrategy"],
                  })
                }
                disabled={saving}
              >
                <option value="thirds">Thirds (33% / 33%)</option>
                <option value="standard">Standard (custom %)</option>
                <option value="none">None</option>
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Exit */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-amber-500" />
            <CardTitle>Time Exit</CardTitle>
          </div>
          <CardDescription>
            Close trades that haven&apos;t made enough progress after a set time. Prevents capital
            from being tied up in stagnant positions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enable time exit</Label>
            <ToggleSwitch
              checked={data.timeExitEnabled}
              onChange={(v) => void handleUpdate({ timeExitEnabled: v })}
              disabled={saving}
            />
          </div>
          {data.timeExitEnabled && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Max hold time (hours)</Label>
                  <p className="text-muted-foreground text-xs">
                    Close the trade if held longer than this
                  </p>
                </div>
                <input
                  type="number"
                  className={INPUT_CLASS}
                  defaultValue={data.timeExitHours}
                  min={1}
                  max={72}
                  step={1}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v) && v >= 1 && v <= 72) void handleUpdate({ timeExitHours: v })
                  }}
                  disabled={saving}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Minimum R:R to keep</Label>
                  <p className="text-muted-foreground text-xs">
                    Only close if P&L is below this R:R ratio (0 = close regardless)
                  </p>
                </div>
                <input
                  type="number"
                  className={INPUT_CLASS}
                  defaultValue={data.timeExitMinRR}
                  min={0}
                  max={3}
                  step={0.1}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v) && v >= 0 && v <= 3) void handleUpdate({ timeExitMinRR: v })
                  }}
                  disabled={saving}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Whipsaw Detection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-orange-500" />
            <CardTitle>Whipsaw Detection</CardTitle>
          </div>
          <CardDescription>
            UT Bot Alerts generates rapid buy/sell flips in ranging markets. This detects choppy
            conditions and temporarily blocks new entries to prevent consecutive losses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enable whipsaw detection</Label>
            <ToggleSwitch
              checked={data.whipsawDetectionEnabled}
              onChange={(v) => void handleUpdate({ whipsawDetectionEnabled: v })}
              disabled={saving}
            />
          </div>
          {data.whipsawDetectionEnabled && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Detection window (hours)</Label>
                  <p className="text-muted-foreground text-xs">
                    How far back to count signal flips
                  </p>
                </div>
                <input
                  type="number"
                  className={INPUT_CLASS}
                  defaultValue={data.whipsawWindowHours}
                  min={1}
                  max={24}
                  step={0.5}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v) && v >= 1 && v <= 24) void handleUpdate({ whipsawWindowHours: v })
                  }}
                  disabled={saving}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Max signals before block</Label>
                  <p className="text-muted-foreground text-xs">
                    Block new entries after this many signals on the same pair
                  </p>
                </div>
                <input
                  type="number"
                  className={INPUT_CLASS}
                  defaultValue={data.whipsawMaxSignals}
                  min={2}
                  max={10}
                  step={1}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v) && v >= 2 && v <= 10) void handleUpdate({ whipsawMaxSignals: v })
                  }}
                  disabled={saving}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Cooldown (minutes)</Label>
                  <p className="text-muted-foreground text-xs">
                    How long to block new entries after whipsaw detected
                  </p>
                </div>
                <input
                  type="number"
                  className={INPUT_CLASS}
                  defaultValue={data.whipsawCooldownMinutes}
                  min={10}
                  max={360}
                  step={10}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v) && v >= 10 && v <= 360)
                      void handleUpdate({ whipsawCooldownMinutes: v })
                  }}
                  disabled={saving}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
