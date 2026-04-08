"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { AiTraderProfile, AiTraderTechnique } from "@fxflow/types"
import { FOREX_PAIR_GROUPS } from "@fxflow/shared"
import { Globe, TrendingUp, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PairViabilityEntry } from "@/app/api/ai-trader/pair-viability/route"

// ─── Labels ──────────────────────────────────────────────────────────────────

const PROFILE_LABELS: Record<AiTraderProfile, { name: string; desc: string }> = {
  scalper: { name: "Scalper", desc: "Very short trades (minutes)" },
  intraday: { name: "Intraday", desc: "Same-day trades (hours)" },
  swing: { name: "Swing", desc: "Multi-day trades (1-5 days)" },
  news: { name: "News", desc: "Trade around news events" },
}

const TECHNIQUE_LABELS: Record<AiTraderTechnique, string> = {
  smc_structure: "SMC Structure (BOS/CHoCH)",
  fair_value_gap: "Fair Value Gaps",
  order_block: "Order Blocks",
  liquidity_sweep: "Liquidity Sweeps",
  supply_demand_zone: "Supply & Demand Zones",
  fibonacci_ote: "Fibonacci OTE",
  rsi: "RSI",
  macd: "MACD",
  ema_alignment: "EMA Alignment",
  bollinger_bands: "Bollinger Bands",
  williams_r: "Williams %R",
  adx_regime: "ADX Regime",
  divergence: "Divergence",
  trend_detection: "Trend Detection",
}

// ─── Toggle Chip ─────────────────────────────────────────────────────────────

function ToggleChip({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80",
      )}
    >
      {label}
    </button>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface AiTraderScanConfigProps {
  pairWhitelist: string[]
  enabledProfiles: Record<AiTraderProfile, boolean>
  enabledTechniques: Record<AiTraderTechnique, boolean>
  saving: boolean
  onSave: (updates: Record<string, unknown>) => void
}

/** Get best viability status across enabled profiles for a pair. */
function getBestViability(
  pair: string,
  viability: PairViabilityEntry[],
  enabledProfiles: Record<AiTraderProfile, boolean>,
): "viable" | "marginal" | "blocked" | "unknown" {
  const entries = viability.filter(
    (v) => v.pair === pair && enabledProfiles[v.profile as AiTraderProfile],
  )
  if (entries.length === 0) return "unknown"
  if (entries.some((e) => e.status === "viable")) return "viable"
  if (entries.some((e) => e.status === "marginal")) return "marginal"
  if (entries.some((e) => e.status === "unknown")) return "unknown"
  return "blocked"
}

const VIABILITY_DOT: Record<string, { className: string; label: string }> = {
  viable: { className: "bg-emerald-500", label: "Good spread/R:R for enabled profiles" },
  marginal: { className: "bg-amber-500", label: "Tight margins — may be filtered" },
  blocked: { className: "bg-red-500", label: "Spread too wide for enabled profiles" },
  unknown: { className: "bg-muted-foreground/40", label: "No ATR data yet — needs first scan" },
}

export function AiTraderScanConfig({
  pairWhitelist,
  enabledProfiles,
  enabledTechniques,
  saving,
  onSave,
}: AiTraderScanConfigProps) {
  const [showPairPicker, setShowPairPicker] = useState(false)
  const [viability, setViability] = useState<PairViabilityEntry[]>([])

  useEffect(() => {
    fetch("/api/ai-trader/pair-viability")
      .then((r) => r.json())
      .then((json: { ok: boolean; data?: PairViabilityEntry[] }) => {
        if (json.ok && json.data) setViability(json.data)
      })
      .catch(() => {})
  }, [])

  const toggleProfile = (profile: AiTraderProfile) => {
    const updated = { ...enabledProfiles, [profile]: !enabledProfiles[profile] }
    onSave({ enabledProfiles: updated })
  }

  const toggleTechnique = (technique: AiTraderTechnique) => {
    const updated = { ...enabledTechniques, [technique]: !enabledTechniques[technique] }
    onSave({ enabledTechniques: updated })
  }

  const addPair = (pair: string) => {
    if (pairWhitelist.includes(pair)) return
    onSave({ pairWhitelist: [...pairWhitelist, pair] })
  }

  const removePair = (pair: string) => {
    onSave({ pairWhitelist: pairWhitelist.filter((p) => p !== pair) })
  }

  const addGroup = (groupLabel: string) => {
    const group = FOREX_PAIR_GROUPS.find((g) => g.label === groupLabel)
    if (!group) return
    const newPairs = group.pairs.map((p) => p.value).filter((p) => !pairWhitelist.includes(p))
    if (newPairs.length === 0) return
    onSave({ pairWhitelist: [...pairWhitelist, ...newPairs] })
  }

  const clearPairs = () => {
    onSave({ pairWhitelist: [] })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="size-4 text-blue-500" />
          Scan Configuration
        </CardTitle>
        <CardDescription>
          Choose which currency pairs, trading styles, and analysis techniques the AI uses.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Currency Pairs ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Currency Pairs</p>
              <p className="text-muted-foreground text-xs">
                {pairWhitelist.length === 0
                  ? "Scanning all 28 pairs (no filter)"
                  : `Scanning ${pairWhitelist.length} selected pairs`}
              </p>
            </div>
            <div className="flex gap-1.5">
              {pairWhitelist.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={clearPairs}
                  disabled={saving}
                >
                  Clear All
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowPairPicker(!showPairPicker)}
                disabled={saving}
              >
                {showPairPicker ? "Done" : "Select Pairs"}
              </Button>
            </div>
          </div>

          {/* Selected pairs */}
          {pairWhitelist.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pairWhitelist.map((pair) => {
                const vs = getBestViability(pair, viability, enabledProfiles)
                const dot = VIABILITY_DOT[vs]
                return (
                  <span
                    key={pair}
                    className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                  >
                    {viability.length > 0 && (
                      <span className={cn("size-1.5 shrink-0 rounded-full", dot?.className)} />
                    )}
                    {pair.replace("_", "/")}
                    <button
                      onClick={() => removePair(pair)}
                      disabled={saving}
                      className="hover:bg-primary/20 focus-visible:ring-ring ml-0.5 rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-1"
                      aria-label={`Remove ${pair.replace("_", "/")}`}
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                )
              })}
            </div>
          )}

          {/* Pair picker */}
          {showPairPicker && (
            <div className="border-border/50 bg-muted/30 space-y-3 rounded-lg border p-3">
              {FOREX_PAIR_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-muted-foreground text-xs font-semibold">
                      {group.label}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px]"
                      onClick={() => addGroup(group.label)}
                      disabled={saving}
                    >
                      Add all
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.pairs.map((pair) => {
                      const selected = pairWhitelist.includes(pair.value)
                      const viabilityStatus = getBestViability(
                        pair.value,
                        viability,
                        enabledProfiles,
                      )
                      const dot = VIABILITY_DOT[viabilityStatus]
                      return (
                        <TooltipProvider key={pair.value} delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() =>
                                  selected ? removePair(pair.value) : addPair(pair.value)
                                }
                                disabled={saving}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                                  "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-1",
                                  selected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-background border-border hover:bg-muted border",
                                )}
                              >
                                {viability.length > 0 && (
                                  <span
                                    className={cn("size-1.5 shrink-0 rounded-full", dot?.className)}
                                  />
                                )}
                                {pair.label}
                              </button>
                            </TooltipTrigger>
                            {viability.length > 0 && dot && (
                              <TooltipContent side="top" className="text-xs">
                                {dot.label}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* ── Trading Profiles ── */}
        <div className="space-y-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <TrendingUp className="size-3.5" />
              Trading Profiles
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Choose which trading styles the AI should look for
            </p>
          </div>
          <div className="space-y-2">
            {(
              Object.entries(PROFILE_LABELS) as [AiTraderProfile, { name: string; desc: string }][]
            ).map(([key, { name, desc }]) => (
              <label
                key={key}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                  enabledProfiles[key] ? "border-primary/30 bg-primary/5" : "border-border/50",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-muted-foreground text-xs">{desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={enabledProfiles[key]}
                  onChange={() => toggleProfile(key)}
                  disabled={saving}
                  className="border-input accent-primary size-4 rounded"
                />
              </label>
            ))}
          </div>
        </div>

        <Separator />

        {/* ── Analysis Techniques ── */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Analysis Techniques</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Toggle which technical analysis methods the AI uses to find trades
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(TECHNIQUE_LABELS) as [AiTraderTechnique, string][]).map(
              ([key, label]) => (
                <ToggleChip
                  key={key}
                  label={label}
                  checked={enabledTechniques[key]}
                  onChange={() => toggleTechnique(key)}
                  disabled={saving}
                />
              ),
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
