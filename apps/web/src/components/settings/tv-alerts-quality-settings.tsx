"use client"

import { useState, useCallback } from "react"
import {
  Loader2,
  TrendingUp,
  Activity,
  BarChart3,
  Clock,
  Shield,
  Target,
  Scale,
} from "lucide-react"
import type { TVAlertsQualityConfig } from "@fxflow/types"
import { TV_ALERTS_QUALITY_DEFAULT_CONFIG } from "@fxflow/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTVAlertsQualityConfig } from "@/hooks/use-tv-alerts-quality-config"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ─── Factor Card ──────────────────────────────────────────────────────────────

function FactorCard({
  icon,
  title,
  description,
  enabled,
  weight,
  onToggle,
  onWeightChange,
  saving,
}: {
  icon: React.ReactNode
  title: string
  description: string
  enabled: boolean
  weight: number
  onToggle: () => void
  onWeightChange: (w: number) => void
  saving: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors",
        enabled ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5", enabled ? "text-foreground" : "text-muted-foreground")}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
          </div>
        </div>
        <Button
          variant={enabled ? "default" : "outline"}
          size="sm"
          onClick={onToggle}
          disabled={saving}
          className="shrink-0"
          aria-label={`${enabled ? "Disable" : "Enable"} ${title}`}
        >
          {enabled ? "On" : "Off"}
        </Button>
      </div>
      {enabled && (
        <div className="mt-3 flex items-center gap-2">
          <Label className="text-muted-foreground text-xs">Weight</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={5}
            defaultValue={weight}
            onBlur={(e) => {
              const val = parseInt(e.target.value) || 0
              if (val !== weight) onWeightChange(Math.max(0, Math.min(100, val)))
            }}
            className="h-7 w-16 text-xs"
            aria-label={`${title} weight`}
          />
          <span className="text-muted-foreground text-xs">%</span>
        </div>
      )}
    </div>
  )
}

// ─── Weight Distribution Bar ──────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export function TVAlertsQualitySettings() {
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

  const formKey = `${data.minScore}-${data.slAtrMultiplier}-${data.tpRiskRewardRatio}-${data.highConfThreshold}-${data.highConfMultiplier}-${data.lowConfThreshold}-${data.lowConfMultiplier}`

  return (
    <div className="space-y-6" key={formKey}>
      {/* Master Toggle + Min Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-4" />
            Confluence Engine
          </CardTitle>
          <CardDescription>
            Evaluate incoming UT Bot signals against multiple technical factors before executing.
            Signals scoring below the minimum threshold are rejected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Signal Quality Filter</p>
              <p className="text-muted-foreground text-xs">
                When enabled, signals are scored 0-10 and must meet the minimum score to execute
              </p>
            </div>
            <Button
              variant={data.enabled ? "default" : "outline"}
              size="sm"
              onClick={() => handleUpdate({ enabled: !data.enabled })}
              disabled={saving}
            >
              {data.enabled ? "Enabled" : "Disabled"}
            </Button>
          </div>

          {data.enabled && (
            <div className="flex items-center gap-3">
              <Label htmlFor="minScore" className="shrink-0 text-sm">
                Minimum Score
              </Label>
              <Input
                id="minScore"
                type="number"
                min={0}
                max={10}
                step={0.5}
                defaultValue={data.minScore}
                onBlur={(e) => {
                  const val = parseFloat(e.target.value) || 0
                  if (val !== data.minScore)
                    handleUpdate({ minScore: Math.max(0, Math.min(10, val)) })
                }}
                className="h-8 w-20"
              />
              <span className="text-muted-foreground text-xs">/ 10</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confluence Filters */}
      {data.enabled && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="size-4" />
                Confluence Filters
              </CardTitle>
              <CardDescription>
                Each filter scores the signal from 0-10. Weights determine how much each factor
                contributes to the final score. Disabled filters are excluded.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <WeightBar config={data} />

              <div className="grid gap-3 sm:grid-cols-2">
                <FactorCard
                  icon={<TrendingUp className="size-4" />}
                  title="Trend Alignment"
                  description="EMA 50/200 — only trade in the direction of the prevailing trend"
                  enabled={data.trendFilter}
                  weight={data.trendWeight}
                  onToggle={() => handleUpdate({ trendFilter: !data.trendFilter })}
                  onWeightChange={(w) => handleUpdate({ trendWeight: w })}
                  saving={saving}
                />
                <FactorCard
                  icon={<Activity className="size-4" />}
                  title="Momentum (RSI)"
                  description="RSI 14 confirms momentum supports the signal direction"
                  enabled={data.momentumFilter}
                  weight={data.momentumWeight}
                  onToggle={() => handleUpdate({ momentumFilter: !data.momentumFilter })}
                  onWeightChange={(w) => handleUpdate({ momentumWeight: w })}
                  saving={saving}
                />
                <FactorCard
                  icon={<BarChart3 className="size-4" />}
                  title="Volatility Regime"
                  description="ADX 14 — suppress signals in ranging/choppy markets"
                  enabled={data.volatilityFilter}
                  weight={data.volatilityWeight}
                  onToggle={() => handleUpdate({ volatilityFilter: !data.volatilityFilter })}
                  onWeightChange={(w) => handleUpdate({ volatilityWeight: w })}
                  saving={saving}
                />
                <FactorCard
                  icon={<TrendingUp className="size-4" />}
                  title="Higher Timeframe"
                  description="Check that the next higher timeframe trend aligns with the signal"
                  enabled={data.htfFilter}
                  weight={data.htfWeight}
                  onToggle={() => handleUpdate({ htfFilter: !data.htfFilter })}
                  onWeightChange={(w) => handleUpdate({ htfWeight: w })}
                  saving={saving}
                />
                <FactorCard
                  icon={<Clock className="size-4" />}
                  title="Session Quality"
                  description="Score based on trading session — London/NY overlap is optimal"
                  enabled={data.sessionFilter}
                  weight={data.sessionWeight}
                  onToggle={() => handleUpdate({ sessionFilter: !data.sessionFilter })}
                  onWeightChange={(w) => handleUpdate({ sessionWeight: w })}
                  saving={saving}
                />
              </div>
            </CardContent>
          </Card>

          {/* SL/TP */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="size-4" />
                Stop Loss &amp; Take Profit
              </CardTitle>
              <CardDescription>
                Automatically set ATR-based stop loss and risk:reward-based take profit on executed
                signals. Protects trades from unlimited downside.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Auto SL */}
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Auto Stop Loss</p>
                      <p className="text-muted-foreground text-xs">
                        SL = ATR × multiplier below/above entry
                      </p>
                    </div>
                    <Button
                      variant={data.autoSL ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleUpdate({ autoSL: !data.autoSL })}
                      disabled={saving}
                    >
                      {data.autoSL ? "On" : "Off"}
                    </Button>
                  </div>
                  {data.autoSL && (
                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground text-xs">ATR ×</Label>
                      <Input
                        type="number"
                        min={0.5}
                        max={5}
                        step={0.1}
                        defaultValue={data.slAtrMultiplier}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value) || 1.5
                          if (val !== data.slAtrMultiplier)
                            handleUpdate({ slAtrMultiplier: Math.max(0.5, Math.min(5, val)) })
                        }}
                        className="h-7 w-16 text-xs"
                        aria-label="ATR multiplier for stop loss"
                      />
                    </div>
                  )}
                </div>

                {/* Auto TP */}
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Auto Take Profit</p>
                      <p className="text-muted-foreground text-xs">TP = SL distance × R:R ratio</p>
                    </div>
                    <Button
                      variant={data.autoTP ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleUpdate({ autoTP: !data.autoTP })}
                      disabled={saving}
                    >
                      {data.autoTP ? "On" : "Off"}
                    </Button>
                  </div>
                  {data.autoTP && (
                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground text-xs">R:R</Label>
                      <Input
                        type="number"
                        min={0.5}
                        max={10}
                        step={0.5}
                        defaultValue={data.tpRiskRewardRatio}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value) || 2
                          if (val !== data.tpRiskRewardRatio)
                            handleUpdate({ tpRiskRewardRatio: Math.max(0.5, Math.min(10, val)) })
                        }}
                        className="h-7 w-16 text-xs"
                        aria-label="Risk to reward ratio"
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dynamic Sizing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="size-4" />
                Dynamic Position Sizing
              </CardTitle>
              <CardDescription>
                Scale position size based on confluence score. High-confidence signals get larger
                positions, low-confidence signals get smaller ones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable Dynamic Sizing</p>
                  <p className="text-muted-foreground text-xs">
                    Multiplies base position size by the confidence multiplier
                  </p>
                </div>
                <Button
                  variant={data.dynamicSizing ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleUpdate({ dynamicSizing: !data.dynamicSizing })}
                  disabled={saving}
                >
                  {data.dynamicSizing ? "On" : "Off"}
                </Button>
              </div>

              {data.dynamicSizing && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                    <p className="text-xs font-medium text-green-600 dark:text-green-400">
                      High Confidence
                    </p>
                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground text-xs">Score ≥</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.5}
                        defaultValue={data.highConfThreshold}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value) || 7.5
                          if (val !== data.highConfThreshold)
                            handleUpdate({ highConfThreshold: val })
                        }}
                        className="h-7 w-16 text-xs"
                        aria-label="High confidence threshold"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground text-xs">Size ×</Label>
                      <Input
                        type="number"
                        min={1}
                        max={3}
                        step={0.05}
                        defaultValue={data.highConfMultiplier}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value) || 1.25
                          if (val !== data.highConfMultiplier)
                            handleUpdate({ highConfMultiplier: val })
                        }}
                        className="h-7 w-16 text-xs"
                        aria-label="High confidence size multiplier"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      Low Confidence
                    </p>
                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground text-xs">Score ≤</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.5}
                        defaultValue={data.lowConfThreshold}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value) || 5.5
                          if (val !== data.lowConfThreshold) handleUpdate({ lowConfThreshold: val })
                        }}
                        className="h-7 w-16 text-xs"
                        aria-label="Low confidence threshold"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground text-xs">Size ×</Label>
                      <Input
                        type="number"
                        min={0.1}
                        max={1}
                        step={0.05}
                        defaultValue={data.lowConfMultiplier}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value) || 0.75
                          if (val !== data.lowConfMultiplier)
                            handleUpdate({ lowConfMultiplier: val })
                        }}
                        className="h-7 w-16 text-xs"
                        aria-label="Low confidence size multiplier"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
