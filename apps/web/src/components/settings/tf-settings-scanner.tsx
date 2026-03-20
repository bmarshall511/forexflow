"use client"

import type { TradeFinderConfigData } from "@fxflow/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Search } from "lucide-react"

export interface TFSettingsProps {
  config: TradeFinderConfigData
  onUpdate: (partial: Partial<TradeFinderConfigData>) => Promise<void>
  saving: boolean
}

const INPUT_CLASS = "bg-background h-8 w-16 rounded border px-2 text-right font-mono text-sm"

export function TFSettingsScanner({ config, onUpdate, saving }: TFSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Search className="size-5 text-blue-500" />
          <CardTitle>Find Trades</CardTitle>
        </div>
        <CardDescription>
          The scanner watches the market and finds potential trades for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scanner toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Scanner</Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Turn the scanner on or off
            </p>
          </div>
          <ToggleSwitch
            checked={config.enabled}
            onChange={(v) => void onUpdate({ enabled: v })}
            disabled={saving}
          />
        </div>

        <Separator />

        {/* Quality filter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label>Quality Filter</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Only show setups rated this high or better
              </p>
            </div>
            <input
              type="number"
              min={1}
              max={18}
              step={0.5}
              defaultValue={config.minScore}
              onBlur={(e) => {
                const num = parseFloat(e.target.value)
                if (!isNaN(num) && num >= 1 && num <= 18) void onUpdate({ minScore: num })
              }}
              className={INPUT_CLASS}
              aria-label="Minimum quality score"
            />
          </div>
          <Progress value={config.minScore} max={18} />
        </div>

        <Separator />

        {/* Pairs to watch */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Pairs to Watch</Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Maximum number of currency pairs to scan at once
            </p>
          </div>
          <input
            type="number"
            min={1}
            max={30}
            step={1}
            defaultValue={config.maxEnabledPairs}
            onBlur={(e) => {
              const num = parseInt(e.target.value)
              if (!isNaN(num) && num >= 1 && num <= 30) void onUpdate({ maxEnabledPairs: num })
            }}
            className={INPUT_CLASS}
            aria-label="Maximum enabled pairs"
          />
        </div>

        <Separator />

        {/* Risk per trade (read-only) */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Risk per Trade</Label>
            <p className="text-muted-foreground mt-0.5 text-xs">Set in OANDA settings</p>
          </div>
          <span className="text-muted-foreground font-mono text-sm">{config.riskPercent}%</span>
        </div>
      </CardContent>
    </Card>
  )
}
