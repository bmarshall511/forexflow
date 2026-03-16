"use client"

import { Shield, Scale, Flame } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AiTraderConfigData } from "@fxflow/types"

interface Preset {
  name: string
  description: string
  icon: typeof Shield
  color: string
  values: Partial<AiTraderConfigData>
}

const PRESETS: Preset[] = [
  {
    name: "Conservative",
    description: "Careful trading with high confidence requirements. Best for beginners.",
    icon: Shield,
    color: "text-blue-500",
    values: {
      operatingMode: "semi_auto",
      minimumConfidence: 80,
      confidenceThreshold: 80,
      maxConcurrentTrades: 3,
      scanIntervalMinutes: 30,
      enabledProfiles: { scalper: true, intraday: true, swing: false, news: false },
    },
  },
  {
    name: "Balanced",
    description: "Moderate settings with a good mix of safety and opportunity.",
    icon: Scale,
    color: "text-amber-500",
    values: {
      operatingMode: "semi_auto",
      minimumConfidence: 65,
      confidenceThreshold: 75,
      maxConcurrentTrades: 5,
      scanIntervalMinutes: 15,
      enabledProfiles: { scalper: true, intraday: true, swing: true, news: true },
    },
  },
  {
    name: "Aggressive",
    description: "Fully autonomous with lower thresholds. More trades, more risk.",
    icon: Flame,
    color: "text-red-500",
    values: {
      operatingMode: "full_auto",
      minimumConfidence: 50,
      confidenceThreshold: 60,
      maxConcurrentTrades: 10,
      scanIntervalMinutes: 5,
      enabledProfiles: { scalper: true, intraday: true, swing: true, news: true },
    },
  },
]

interface SettingsPresetsProps {
  onApply: (values: Partial<AiTraderConfigData>) => void
  disabled?: boolean
}

export function SettingsPresets({ onApply, disabled }: SettingsPresetsProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Quick Setup
        </p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">
          Choose a preset to get started quickly. You can customize individual settings below.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {PRESETS.map((preset) => (
          <div
            key={preset.name}
            className="bg-background flex flex-col justify-between gap-3 rounded-lg border p-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <preset.icon className={cn("size-4", preset.color)} />
                <p className="text-sm font-medium">{preset.name}</p>
              </div>
              <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                {preset.description}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-full text-xs"
              onClick={() => onApply(preset.values)}
              disabled={disabled}
            >
              Apply {preset.name}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
