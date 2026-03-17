"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { TrendingUp, TrendingDown, Check, Zap, Search } from "lucide-react"
import { FOREX_PAIR_GROUPS } from "@fxflow/shared"
import type { SmartFlowPreset } from "@fxflow/types"
import { PRESET_INFO, PRESET_KEYS } from "./trade-builder-presets"

// ─── Step 1: Pick a Pair ────────────────────────────────────────────────

export function StepPair({
  pair,
  onSelect,
  search,
  onSearch,
}: {
  pair: string
  onSelect: (v: string) => void
  search: string
  onSearch: (v: string) => void
}) {
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return FOREX_PAIR_GROUPS
    return FOREX_PAIR_GROUPS.map((g) => ({
      ...g,
      pairs: g.pairs.filter(
        (p) => p.label.toLowerCase().includes(q) || p.value.toLowerCase().includes(q),
      ),
    })).filter((g) => g.pairs.length > 0)
  }, [search])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search pairs…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="min-h-[44px] pl-9"
          aria-label="Search currency pairs"
        />
      </div>
      {filtered.map((group) => (
        <div key={group.label}>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold">{group.label}</h3>
            {group.label === "Majors" && (
              <Badge variant="secondary" className="text-[10px]">
                Recommended for beginners
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {group.pairs.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => onSelect(p.value)}
                className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  pair === p.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50 hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Step 2: Pick Direction ─────────────────────────────────────────────

export function StepDirection({
  direction,
  onSelect,
}: {
  direction: "long" | "short" | null
  onSelect: (v: "long" | "short") => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelect("long")}
          className={`min-h-[44px] rounded-xl border-2 p-5 text-left transition-colors ${
            direction === "long"
              ? "border-emerald-500 bg-emerald-500/10"
              : "border-border hover:border-emerald-500/50"
          }`}
        >
          <TrendingUp className="mb-2 size-8 text-emerald-500" />
          <div className="text-base font-semibold">Buy (Long)</div>
          <p className="text-muted-foreground mt-1 text-sm">
            You think the price will go UP. You&apos;ll profit when the first currency gets
            stronger.
          </p>
        </button>
        <button
          type="button"
          onClick={() => onSelect("short")}
          className={`min-h-[44px] rounded-xl border-2 p-5 text-left transition-colors ${
            direction === "short"
              ? "border-red-500 bg-red-500/10"
              : "border-border hover:border-red-500/50"
          }`}
        >
          <TrendingDown className="mb-2 size-8 text-red-500" />
          <div className="text-base font-semibold">Sell (Short)</div>
          <p className="text-muted-foreground mt-1 text-sm">
            You think the price will go DOWN. You&apos;ll profit when the first currency gets
            weaker.
          </p>
        </button>
      </div>
      <p className="text-muted-foreground text-center text-xs">
        Not sure? Start with a Majors pair and Buy — it&apos;s the simplest way to begin.
      </p>
    </div>
  )
}

// ─── Step 3: Choose Strategy ────────────────────────────────────────────

export function StepStrategy({
  preset,
  onSelect,
}: {
  preset: Exclude<SmartFlowPreset, "custom">
  onSelect: (v: Exclude<SmartFlowPreset, "custom">) => void
}) {
  return (
    <div className="space-y-3">
      {PRESET_KEYS.map((key) => {
        const info = PRESET_INFO[key]
        const Icon = info.icon
        const isRecovery = key === "recovery"
        const isRecommended = key === "steady_growth"
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={`flex min-h-[44px] w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
              preset === key
                ? "border-primary bg-primary/5"
                : isRecovery
                  ? "border-amber-500/40 hover:border-amber-500"
                  : "border-border hover:border-primary/50"
            }`}
          >
            <Icon
              className={`mt-0.5 size-5 shrink-0 ${preset === key ? "text-primary" : "text-muted-foreground"}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{info.label}</span>
                <span className={`text-[10px] font-medium ${info.riskColor}`}>
                  {info.risk} risk
                </span>
                {isRecommended && (
                  <Badge variant="secondary" className="text-[10px]">
                    Recommended
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{info.desc}</p>
            </div>
            {preset === key && <Check className="text-primary mt-0.5 size-5 shrink-0" />}
          </button>
        )
      })}
    </div>
  )
}

// ─── Step 4: Review & Confirm ───────────────────────────────────────────

export function StepReview({
  pair,
  direction,
  preset,
  submitting,
  onSubmit,
}: {
  pair: string
  direction: "long" | "short"
  preset: Exclude<SmartFlowPreset, "custom">
  submitting: boolean
  onSubmit: () => void
}) {
  const info = PRESET_INFO[preset]
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-base font-semibold">Trade Summary</h3>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <SummaryRow label="Pair" value={pair} />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Direction</span>
            <Badge variant={direction === "long" ? "default" : "destructive"}>
              {direction === "long" ? "Buy (Long)" : "Sell (Short)"}
            </Badge>
          </div>
          <SummaryRow label="Strategy" value={info.label} />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Risk Level</span>
            <span className={`font-medium ${info.riskColor}`}>{info.risk}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Timing</span>
            <span className="text-muted-foreground text-xs">Depends on market conditions</span>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <h4 className="mb-1 text-sm font-semibold">What happens next?</h4>
          <p className="text-muted-foreground text-xs leading-relaxed">
            SmartFlow will place a trade and manage it automatically. You&apos;ll see it in the
            Active Trades tab. It will move your stop-loss to breakeven, trail profits, and close at
            the right time — all without you needing to do anything.
          </p>
        </CardContent>
      </Card>
      <Button
        onClick={onSubmit}
        disabled={submitting}
        className="min-h-[44px] w-full gap-2 text-base font-semibold"
      >
        <Zap className="size-5" />
        {submitting ? "Saving…" : "Start SmartFlow Trade"}
      </Button>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
