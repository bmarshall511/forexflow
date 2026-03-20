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
                : "Disabled -- setups are shown but not placed"}
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
            <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                This places real trades with real money. Make sure you understand the risks.
              </span>
            </div>

            <div className="relative my-4">
              <Separator />
              <span className="bg-card text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 px-2 text-[10px] uppercase tracking-wider">
                Quality &amp; Targets
              </span>
            </div>

            <NumberRow
              label="Minimum quality score"
              desc="Only auto-trade the best setups"
              value={config.autoTradeMinScore}
              min={1} max={18} step={0.5}
              onCommit={(v) => void onUpdate({ autoTradeMinScore: v })}
            />
            <NumberRow
              label="Minimum profit target"
              desc="e.g. 2 means aim for $2 profit for every $1 risked"
              value={config.autoTradeMinRR}
              min={0.5} max={10} step={0.5}
              onCommit={(v) => void onUpdate({ autoTradeMinRR: v })}
            />

            <div className="relative my-4">
              <Separator />
              <span className="bg-card text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 px-2 text-[10px] uppercase tracking-wider">
                Safety Limits
              </span>
            </div>

            <NumberRow
              label="Trades at once"
              desc="Maximum trades open at the same time"
              value={config.autoTradeMaxConcurrent}
              min={1} max={20} step={1} integer
              onCommit={(v) => void onUpdate({ autoTradeMaxConcurrent: v })}
            />
            <NumberRow
              label="Trades per day"
              desc="Maximum new trades placed each day (0 = no limit)"
              value={config.autoTradeMaxDaily}
              min={0} max={50} step={1} integer
              onCommit={(v) => void onUpdate({ autoTradeMaxDaily: v })}
            />
            <NumberRow
              label="Max money at risk"
              desc="Pause trading if this much of your balance is at risk"
              value={config.autoTradeMaxRiskPercent}
              min={0.5} max={50} step={0.5}
              suffix="%"
              onCommit={(v) => void onUpdate({ autoTradeMaxRiskPercent: v })}
            />

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
              <p className="text-muted-foreground mt-1 text-[10px]">
                Cancels all currently pending auto-placed orders
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* Inline helper to keep the main component under 150 LOC */
function NumberRow({ label, desc, value, min, max, step, integer, suffix, onCommit }: {
  label: string; desc: string; value: number
  min: number; max: number; step: number; integer?: boolean; suffix?: string
  onCommit: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Label>{label}</Label>
        <p className="text-muted-foreground mt-0.5 text-xs">{desc}</p>
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={min} max={max} step={step}
          defaultValue={value}
          onBlur={(e) => {
            const num = integer ? parseInt(e.target.value) : parseFloat(e.target.value)
            if (!isNaN(num) && num >= min && num <= max) onCommit(num)
          }}
          className={INPUT_CLASS}
          aria-label={label}
        />
        {suffix && <span className="text-muted-foreground text-xs">{suffix}</span>}
      </div>
    </div>
  )
}
