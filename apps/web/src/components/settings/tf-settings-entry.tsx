"use client"

import type { TFSettingsProps } from "./tf-settings-scanner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { Separator } from "@/components/ui/separator"
import { Target } from "lucide-react"

const INPUT_CLASS = "bg-background h-8 w-16 rounded border px-2 text-right font-mono text-sm"

export function TFSettingsEntry({ config, onUpdate, saving }: TFSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="size-5 text-violet-500" />
          <CardTitle>How Trades Are Entered</CardTitle>
        </div>
        <CardDescription>Control how and when trades are placed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Entry confirmation */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Wait for Bounce</Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Don&apos;t enter until price shows it&apos;s bouncing at the zone. This prevents
              entering too early.
            </p>
          </div>
          <ToggleSwitch
            checked={config.entryConfirmation}
            onChange={(v) => void onUpdate({ entryConfirmation: v })}
            disabled={saving}
          />
        </div>

        {config.entryConfirmation && (
          <div className="flex items-center justify-between pl-4">
            <div>
              <Label>Timeout</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Give up after this many candles if no bounce is seen
              </p>
            </div>
            <input
              type="number"
              min={1}
              max={20}
              step={1}
              defaultValue={config.confirmationTimeout}
              onBlur={(e) => {
                const num = parseInt(e.target.value)
                if (!isNaN(num) && num >= 1 && num <= 20)
                  void onUpdate({ confirmationTimeout: num })
              }}
              className={INPUT_CLASS}
              aria-label="Confirmation timeout candles"
            />
          </div>
        )}

        <Separator />

        {/* Shadow mode */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Shadow Mode</Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Practice run -- find trades but don&apos;t place real orders. Great for testing
              your settings.
            </p>
          </div>
          <ToggleSwitch
            checked={config.shadowMode}
            onChange={(v) => void onUpdate({ shadowMode: v })}
            disabled={saving}
          />
        </div>

        <Separator />

        {/* Smart sizing */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Smart Position Sizing</Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Bet more on high-quality setups, less on lower-quality ones. Never risks more
              than your configured amount.
            </p>
          </div>
          <ToggleSwitch
            checked={config.smartSizing}
            onChange={(v) => void onUpdate({ smartSizing: v })}
            disabled={saving}
          />
        </div>
      </CardContent>
    </Card>
  )
}
