"use client"

import type {
  TradeFinderPairConfig,
  TradeFinderTimeframeSet,
  TradeFinderTimeframeSpeed,
} from "@fxflow/types"
import type { TFSettingsProps } from "./tf-settings-scanner"
import { FOREX_PAIR_GROUPS } from "@fxflow/shared"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Globe2, Zap } from "lucide-react"

interface Props extends TFSettingsProps {
  autoTradeEnabledPairCount: number
}

const TF_SET_OPTIONS = [
  { value: "hourly", label: "Hourly", desc: "H1 / M15 / M5" },
  { value: "daily", label: "Daily", desc: "D / H1 / M15" },
  { value: "weekly", label: "Weekly", desc: "W / D / H1" },
  { value: "monthly", label: "Monthly", desc: "M / W / D" },
]

export function TFSettingsPairs({ config, onUpdate, saving, autoTradeEnabledPairCount }: Props) {
  const pairs = config.pairs
  const enabledCount = pairs.filter((p) => p.enabled).length

  const getPairConfig = (instrument: string): TradeFinderPairConfig | undefined =>
    pairs.find((p) => p.instrument === instrument)

  const togglePair = async (instrument: string) => {
    const existing = getPairConfig(instrument)
    let newPairs: TradeFinderPairConfig[]
    if (existing) {
      newPairs = pairs.map((p) => (p.instrument === instrument ? { ...p, enabled: !p.enabled } : p))
    } else {
      if (enabledCount >= config.maxEnabledPairs) {
        toast.error(`Maximum ${config.maxEnabledPairs} pairs allowed`)
        return
      }
      newPairs = [
        ...pairs,
        { instrument, enabled: true, timeframeSet: "daily" as TradeFinderTimeframeSet },
      ]
    }
    await onUpdate({ pairs: newPairs })
  }

  const togglePairAutoTrade = async (instrument: string) => {
    const newPairs = pairs.map((p) =>
      p.instrument === instrument ? { ...p, autoTradeEnabled: !(p.autoTradeEnabled !== false) } : p,
    )
    await onUpdate({ pairs: newPairs })
  }

  const changeTfSet = async (instrument: string, timeframeSet: TradeFinderTimeframeSet) => {
    const newPairs = pairs.map((p) => (p.instrument === instrument ? { ...p, timeframeSet } : p))
    await onUpdate({ pairs: newPairs })
  }

  const changeSpeed = async (instrument: string, speed: TradeFinderTimeframeSpeed) => {
    const newPairs = pairs.map((p) =>
      p.instrument === instrument ? { ...p, timeframeSpeed: speed } : p,
    )
    await onUpdate({ pairs: newPairs })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe2 className="size-5 text-sky-500" />
          <CardTitle>Currency Pairs</CardTitle>
        </div>
        <CardDescription>
          {enabledCount}/{config.maxEnabledPairs} enabled.
          {config.autoTradeEnabled && ` ${autoTradeEnabledPairCount} with auto-trade.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {FOREX_PAIR_GROUPS.map((group) => (
          <PairGroup
            key={group.label}
            label={group.label}
            groupPairs={group.pairs}
            config={config}
            enabledCount={enabledCount}
            getPairConfig={getPairConfig}
            onToggle={togglePair}
            onToggleAuto={togglePairAutoTrade}
            onChangeTf={changeTfSet}
            onChangeSpeed={changeSpeed}
            saving={saving}
          />
        ))}
      </CardContent>
    </Card>
  )
}

/* Extracted to keep parent under 150 LOC */
function PairGroup({
  label,
  groupPairs,
  config,
  enabledCount,
  getPairConfig,
  onToggle,
  onToggleAuto,
  onChangeTf,
  onChangeSpeed,
  saving,
}: {
  label: string
  groupPairs: { value: string; label: string }[]
  config: TFSettingsProps["config"]
  enabledCount: number
  getPairConfig: (i: string) => TradeFinderPairConfig | undefined
  onToggle: (i: string) => Promise<void>
  onToggleAuto: (i: string) => Promise<void>
  onChangeTf: (i: string, tf: TradeFinderTimeframeSet) => Promise<void>
  onChangeSpeed: (i: string, speed: TradeFinderTimeframeSpeed) => Promise<void>
  saving: boolean
}) {
  return (
    <div>
      <h3 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
        {label}
      </h3>
      <div className="space-y-1">
        {groupPairs.map((fp) => {
          const pc = getPairConfig(fp.value)
          const isEnabled = pc?.enabled ?? false
          const isAdded = !!pc
          const atLimit = enabledCount >= config.maxEnabledPairs && !isEnabled
          const pairAutoTrade = pc?.autoTradeEnabled !== false

          return (
            <div
              key={fp.value}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors",
                isEnabled ? "bg-accent/50" : "hover:bg-muted/50",
              )}
            >
              <button
                onClick={() => void onToggle(fp.value)}
                disabled={(atLimit && !isEnabled) || saving}
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                  isEnabled
                    ? "bg-primary border-primary text-primary-foreground"
                    : atLimit
                      ? "border-muted-foreground/30 cursor-not-allowed"
                      : "border-muted-foreground hover:border-primary",
                )}
                aria-label={`Toggle ${fp.label}`}
              >
                {isEnabled && (
                  <svg
                    viewBox="0 0 12 12"
                    className="size-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </button>

              <span
                className={cn(
                  "flex-1 font-mono text-sm",
                  isEnabled ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {fp.label}
              </span>

              {isEnabled && config.autoTradeEnabled && (
                <button
                  onClick={() => void onToggleAuto(fp.value)}
                  disabled={saving}
                  className={cn(
                    "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                    pairAutoTrade
                      ? "border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-400"
                      : "text-muted-foreground hover:border-border border-transparent",
                  )}
                  aria-label={`Toggle auto-trade for ${fp.label}`}
                >
                  <Zap className="size-3" />
                  {pairAutoTrade ? "Auto" : "Manual"}
                </button>
              )}

              {isAdded && (
                <Select
                  value={pc!.timeframeSet}
                  onValueChange={(v) => void onChangeTf(fp.value, v as TradeFinderTimeframeSet)}
                >
                  <SelectTrigger className="w-36" aria-label={`Timeframe set for ${fp.label}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TF_SET_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label} ({opt.desc})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {isAdded && (
                <Select
                  value={pc!.timeframeSpeed ?? "standard"}
                  onValueChange={(v) =>
                    void onChangeSpeed(fp.value, v as TradeFinderTimeframeSpeed)
                  }
                >
                  <SelectTrigger className="w-24" aria-label={`Speed for ${fp.label}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="fast">Fast</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
