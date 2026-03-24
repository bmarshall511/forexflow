"use client"

import type { TFSettingsProps } from "./tf-settings-scanner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Zap } from "lucide-react"

interface Props extends TFSettingsProps {
  autoTradeEnabledPairCount: number
  onCancelAll: () => Promise<void>
  cancellingAuto: boolean
}

const INPUT_CLASS = "bg-background h-8 w-16 rounded border px-2 text-right font-mono text-sm"

export function TFSettingsAutoTrade({
  config,
  onUpdate,
  saving,
  autoTradeEnabledPairCount,
  onCancelAll,
  cancellingAuto,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="size-5 text-teal-500" />
          <CardTitle>Automatic Trading</CardTitle>
        </div>
        <CardDescription>
          Let the system place trades for you when it finds good setups.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Auto-Trade</Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {config.autoTradeEnabled
                ? `Active on ${autoTradeEnabledPairCount} pair(s)`
                : "Disabled — setups are shown but not placed"}
            </p>
          </div>
          <ToggleSwitch
            checked={config.autoTradeEnabled}
            onChange={(v) => void onUpdate({ autoTradeEnabled: v })}
            disabled={saving}
          />
        </div>

        {config.autoTradeEnabled && (
          <>
            {/* Warning */}
            <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                This places real trades with real money. Make sure you understand the risks.
              </span>
            </div>

            <Separator />

            <AutoTradeFields config={config} onUpdate={onUpdate} saving={saving} />

            <Separator />

            {/* Cancel all */}
            <div>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-xs"
                onClick={() => void onCancelAll()}
                disabled={cancellingAuto}
              >
                {cancellingAuto ? "Cancelling..." : "Cancel All Auto-Placed Orders"}
              </Button>
              <p className="text-muted-foreground mt-1.5 text-[10px]">
                Cancels all currently pending auto-placed orders
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Extracted to keep the parent under 150 LOC */
function AutoTradeFields({ config, onUpdate, saving }: TFSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Min quality score */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Minimum quality score</Label>
          <p className="text-muted-foreground mt-0.5 text-xs">Only auto-trade the best setups</p>
        </div>
        <input
          type="number"
          min={1}
          max={18}
          step={0.5}
          defaultValue={config.autoTradeMinScore}
          onBlur={(e) => {
            const n = parseFloat(e.target.value)
            if (!isNaN(n) && n >= 1 && n <= 18) void onUpdate({ autoTradeMinScore: n })
          }}
          className={INPUT_CLASS}
          aria-label="Minimum quality score"
        />
      </div>

      <Separator />

      {/* Min profit target */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Minimum profit target</Label>
          <p className="text-muted-foreground mt-0.5 text-xs">
            e.g. 2 means aim for $2 profit for every $1 risked
          </p>
        </div>
        <input
          type="number"
          min={0.5}
          max={10}
          step={0.5}
          defaultValue={config.autoTradeMinRR}
          onBlur={(e) => {
            const n = parseFloat(e.target.value)
            if (!isNaN(n) && n >= 0.5 && n <= 10) void onUpdate({ autoTradeMinRR: n })
          }}
          className={INPUT_CLASS}
          aria-label="Minimum profit target"
        />
      </div>

      <Separator />

      {/* Trades at once */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Trades at once</Label>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Maximum trades open at the same time
          </p>
        </div>
        <input
          type="number"
          min={1}
          max={20}
          step={1}
          defaultValue={config.autoTradeMaxConcurrent}
          onBlur={(e) => {
            const n = parseInt(e.target.value)
            if (!isNaN(n) && n >= 1 && n <= 20) void onUpdate({ autoTradeMaxConcurrent: n })
          }}
          className={INPUT_CLASS}
          aria-label="Trades at once"
        />
      </div>

      <Separator />

      {/* Trades per day */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Trades per day</Label>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Maximum new trades placed each day (0 = no limit)
          </p>
        </div>
        <input
          type="number"
          min={0}
          max={50}
          step={1}
          defaultValue={config.autoTradeMaxDaily}
          onBlur={(e) => {
            const n = parseInt(e.target.value)
            if (!isNaN(n) && n >= 0 && n <= 50) void onUpdate({ autoTradeMaxDaily: n })
          }}
          className={INPUT_CLASS}
          aria-label="Trades per day"
        />
      </div>

      <Separator />

      {/* Max money at risk */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Max money at risk</Label>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Pause trading if this much of your balance is at risk
          </p>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0.5}
            max={50}
            step={0.5}
            defaultValue={config.autoTradeMaxRiskPercent}
            onBlur={(e) => {
              const n = parseFloat(e.target.value)
              if (!isNaN(n) && n >= 0.5 && n <= 50) void onUpdate({ autoTradeMaxRiskPercent: n })
            }}
            className={INPUT_CLASS}
            aria-label="Max money at risk"
          />
          <span className="text-muted-foreground text-xs">%</span>
        </div>
      </div>

      <Separator />

      {/* Cancel on invalidation */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Cancel when setup breaks</Label>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Automatically cancel orders if the trade idea is no longer valid
          </p>
        </div>
        <ToggleSwitch
          checked={config.autoTradeCancelOnInvalidation}
          onChange={(v) => void onUpdate({ autoTradeCancelOnInvalidation: v })}
          disabled={saving}
        />
      </div>
    </div>
  )
}
