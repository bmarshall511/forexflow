"use client"

import { useState, useCallback } from "react"
import { Loader2, Shield, BarChart3, Target, Scale } from "lucide-react"
import type { TVAlertsQualityConfig } from "@fxflow/types"
import { TV_ALERTS_QUALITY_DEFAULT_CONFIG } from "@fxflow/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { Separator } from "@/components/ui/separator"
import { useTVAlertsQualityConfig } from "@/hooks/use-tv-alerts-quality-config"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const INPUT_CLASS = "bg-background h-8 w-16 rounded border px-2 text-right font-mono text-sm"

export function TVASettingsQuality() {
  const { config, isLoading, update } = useTVAlertsQualityConfig()
  const [saving, setSaving] = useState(false)

  const data = config ?? TV_ALERTS_QUALITY_DEFAULT_CONFIG

  const handleUpdate = useCallback(
    async (partial: Partial<TVAlertsQualityConfig>) => {
      setSaving(true)
      try {
        await update(partial)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed")
      } finally {
        setSaving(false)
      }
    },
    [update],
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Confluence Engine */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-purple-500" />
            <CardTitle>Confluence Engine</CardTitle>
          </div>
          <CardDescription>
            Evaluate incoming UT Bot signals against multiple technical factors before executing.
            Signals scoring below the minimum threshold are rejected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Signal Quality Filter</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Score signals 0-10 based on technical confluence before executing
              </p>
            </div>
            <ToggleSwitch
              checked={data.enabled}
              onChange={(v) => void handleUpdate({ enabled: v })}
              disabled={saving}
            />
          </div>

          {data.enabled && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Minimum Score</Label>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Signals below this score are rejected
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    defaultValue={data.minScore}
                    onBlur={(e) => {
                      const num = parseFloat(e.target.value)
                      if (!isNaN(num) && num >= 0 && num <= 10) void handleUpdate({ minScore: num })
                    }}
                    className={INPUT_CLASS}
                    aria-label="Minimum confluence score"
                  />
                  <span className="text-muted-foreground text-xs">/ 10</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Confluence Filters */}
      {data.enabled && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="size-5 text-blue-500" />
                <CardTitle>Confluence Filters</CardTitle>
              </div>
              <CardDescription>
                Each filter scores the signal from 0-10. Weights determine how much each factor
                contributes. Disabled filters are excluded from the score.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <WeightBar config={data} />

              <Separator />

              <FilterRow
                label="Trend Alignment"
                description="EMA 50/200 — only trade in the direction of the prevailing trend"
                enabled={data.trendFilter}
                weight={data.trendWeight}
                onToggle={(v) => void handleUpdate({ trendFilter: v })}
                onWeight={(w) => void handleUpdate({ trendWeight: w })}
                saving={saving}
              />
              <Separator />
              <FilterRow
                label="Momentum (RSI)"
                description="RSI 14 confirms momentum supports the signal direction"
                enabled={data.momentumFilter}
                weight={data.momentumWeight}
                onToggle={(v) => void handleUpdate({ momentumFilter: v })}
                onWeight={(w) => void handleUpdate({ momentumWeight: w })}
                saving={saving}
              />
              <Separator />
              <FilterRow
                label="Volatility Regime"
                description="ADX 14 — suppress signals in ranging/choppy markets"
                enabled={data.volatilityFilter}
                weight={data.volatilityWeight}
                onToggle={(v) => void handleUpdate({ volatilityFilter: v })}
                onWeight={(w) => void handleUpdate({ volatilityWeight: w })}
                saving={saving}
              />
              <Separator />
              <FilterRow
                label="Higher Timeframe"
                description="Check that the next higher timeframe trend aligns with the signal"
                enabled={data.htfFilter}
                weight={data.htfWeight}
                onToggle={(v) => void handleUpdate({ htfFilter: v })}
                onWeight={(w) => void handleUpdate({ htfWeight: w })}
                saving={saving}
              />
              <Separator />
              <FilterRow
                label="Session Quality"
                description="Score based on trading session — London/NY overlap is optimal"
                enabled={data.sessionFilter}
                weight={data.sessionWeight}
                onToggle={(v) => void handleUpdate({ sessionFilter: v })}
                onWeight={(w) => void handleUpdate({ sessionWeight: w })}
                saving={saving}
              />
            </CardContent>
          </Card>

          {/* SL/TP */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="size-5 text-violet-500" />
                <CardTitle>Stop Loss &amp; Take Profit</CardTitle>
              </div>
              <CardDescription>
                Automatically set ATR-based stop loss and risk:reward-based take profit on executed
                signals. Protects trades from unlimited downside.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Stop Loss</Label>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    SL distance = ATR × multiplier below/above entry
                  </p>
                </div>
                <ToggleSwitch
                  checked={data.autoSL}
                  onChange={(v) => void handleUpdate({ autoSL: v })}
                  disabled={saving}
                />
              </div>

              {data.autoSL && (
                <div className="flex items-center justify-between pl-4">
                  <div>
                    <Label>ATR Multiplier</Label>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Higher = wider stop, lower = tighter stop
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0.5}
                      max={5}
                      step={0.1}
                      defaultValue={data.slAtrMultiplier}
                      onBlur={(e) => {
                        const num = parseFloat(e.target.value)
                        if (!isNaN(num) && num >= 0.5 && num <= 5)
                          void handleUpdate({ slAtrMultiplier: num })
                      }}
                      className={INPUT_CLASS}
                      aria-label="ATR multiplier for stop loss"
                    />
                    <span className="text-muted-foreground text-xs">× ATR</span>
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Take Profit</Label>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    TP distance = SL distance × risk:reward ratio
                  </p>
                </div>
                <ToggleSwitch
                  checked={data.autoTP}
                  onChange={(v) => void handleUpdate({ autoTP: v })}
                  disabled={saving}
                />
              </div>

              {data.autoTP && (
                <div className="flex items-center justify-between pl-4">
                  <div>
                    <Label>Risk:Reward Ratio</Label>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      2.0 means TP is 2× the SL distance
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">1:</span>
                    <input
                      type="number"
                      min={0.5}
                      max={10}
                      step={0.5}
                      defaultValue={data.tpRiskRewardRatio}
                      onBlur={(e) => {
                        const num = parseFloat(e.target.value)
                        if (!isNaN(num) && num >= 0.5 && num <= 10)
                          void handleUpdate({ tpRiskRewardRatio: num })
                      }}
                      className={INPUT_CLASS}
                      aria-label="Risk to reward ratio"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dynamic Sizing */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Scale className="size-5 text-teal-500" />
                <CardTitle>Dynamic Position Sizing</CardTitle>
              </div>
              <CardDescription>
                Scale position size based on confluence score. High-confidence signals get larger
                positions, low-confidence signals get smaller ones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Dynamic Sizing</Label>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Multiply base position size by confidence-based multiplier
                  </p>
                </div>
                <ToggleSwitch
                  checked={data.dynamicSizing}
                  onChange={(v) => void handleUpdate({ dynamicSizing: v })}
                  disabled={saving}
                />
              </div>

              {data.dynamicSizing && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between pl-4">
                    <div>
                      <Label>High Confidence Threshold</Label>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Score ≥ this = scale up
                      </p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      defaultValue={data.highConfThreshold}
                      onBlur={(e) => {
                        const num = parseFloat(e.target.value)
                        if (!isNaN(num) && num >= 0 && num <= 10)
                          void handleUpdate({ highConfThreshold: num })
                      }}
                      className={INPUT_CLASS}
                      aria-label="High confidence threshold"
                    />
                  </div>

                  <div className="flex items-center justify-between pl-4">
                    <div>
                      <Label>High Confidence Multiplier</Label>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Size multiplied by this for high-score signals
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={3}
                        step={0.05}
                        defaultValue={data.highConfMultiplier}
                        onBlur={(e) => {
                          const num = parseFloat(e.target.value)
                          if (!isNaN(num) && num >= 1 && num <= 3)
                            void handleUpdate({ highConfMultiplier: num })
                        }}
                        className={INPUT_CLASS}
                        aria-label="High confidence multiplier"
                      />
                      <span className="text-muted-foreground text-xs">×</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between pl-4">
                    <div>
                      <Label>Low Confidence Threshold</Label>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Score ≤ this = scale down
                      </p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      defaultValue={data.lowConfThreshold}
                      onBlur={(e) => {
                        const num = parseFloat(e.target.value)
                        if (!isNaN(num) && num >= 0 && num <= 10)
                          void handleUpdate({ lowConfThreshold: num })
                      }}
                      className={INPUT_CLASS}
                      aria-label="Low confidence threshold"
                    />
                  </div>

                  <div className="flex items-center justify-between pl-4">
                    <div>
                      <Label>Low Confidence Multiplier</Label>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Size multiplied by this for low-score signals
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0.1}
                        max={1}
                        step={0.05}
                        defaultValue={data.lowConfMultiplier}
                        onBlur={(e) => {
                          const num = parseFloat(e.target.value)
                          if (!isNaN(num) && num >= 0.1 && num <= 1)
                            void handleUpdate({ lowConfMultiplier: num })
                        }}
                        className={INPUT_CLASS}
                        aria-label="Low confidence multiplier"
                      />
                      <span className="text-muted-foreground text-xs">×</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FilterRow({
  label,
  description,
  enabled,
  weight,
  onToggle,
  onWeight,
  saving,
}: {
  label: string
  description: string
  enabled: boolean
  weight: number
  onToggle: (v: boolean) => void
  onWeight: (w: number) => void
  saving: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>{label}</Label>
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        </div>
        <ToggleSwitch checked={enabled} onChange={onToggle} disabled={saving} />
      </div>
      {enabled && (
        <div className="flex items-center justify-between pl-4">
          <div>
            <Label>Weight</Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Relative importance in the final score
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              defaultValue={weight}
              onBlur={(e) => {
                const num = parseInt(e.target.value)
                if (!isNaN(num) && num >= 0 && num <= 100) onWeight(num)
              }}
              className={INPUT_CLASS}
              aria-label={`${label} weight`}
            />
            <span className="text-muted-foreground text-xs">%</span>
          </div>
        </div>
      )}
    </div>
  )
}

function WeightBar({ config }: { config: TVAlertsQualityConfig }) {
  const factors = [
    {
      key: "trend",
      label: "Trend",
      enabled: config.trendFilter,
      weight: config.trendWeight,
      color: "bg-blue-500",
    },
    {
      key: "momentum",
      label: "RSI",
      enabled: config.momentumFilter,
      weight: config.momentumWeight,
      color: "bg-purple-500",
    },
    {
      key: "volatility",
      label: "ADX",
      enabled: config.volatilityFilter,
      weight: config.volatilityWeight,
      color: "bg-amber-500",
    },
    {
      key: "htf",
      label: "HTF",
      enabled: config.htfFilter,
      weight: config.htfWeight,
      color: "bg-emerald-500",
    },
    {
      key: "session",
      label: "Session",
      enabled: config.sessionFilter,
      weight: config.sessionWeight,
      color: "bg-rose-500",
    },
  ]
  const enabledFactors = factors.filter((f) => f.enabled)
  const totalWeight = enabledFactors.reduce((sum, f) => sum + f.weight, 0)

  if (enabledFactors.length === 0) return null

  return (
    <div className="space-y-1.5">
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {enabledFactors.map((f) => (
          <div
            key={f.key}
            className={cn(f.color, "transition-all")}
            style={{ width: `${totalWeight > 0 ? (f.weight / totalWeight) * 100 : 0}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {enabledFactors.map((f) => (
          <div key={f.key} className="flex items-center gap-1.5">
            <div className={cn("size-2 rounded-full", f.color)} />
            <span className="text-muted-foreground text-xs">
              {f.label} {totalWeight > 0 ? Math.round((f.weight / totalWeight) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
