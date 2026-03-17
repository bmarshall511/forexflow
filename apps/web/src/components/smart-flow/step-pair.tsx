"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Info } from "lucide-react"
import { FOREX_PAIR_GROUPS } from "@fxflow/shared"
import { getPairFlags } from "./currency-flags"

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
      {/* Educational callout */}
      <div className="flex gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
        <Info className="mt-0.5 size-4 shrink-0 text-blue-500" aria-hidden="true" />
        <p className="text-muted-foreground text-sm leading-relaxed">
          Currency pairs show two currencies. <strong>EUR/USD</strong> means Euro vs US Dollar. When
          you buy, you&apos;re betting the first currency will get stronger.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search pairs..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="min-h-[44px] pl-9"
          aria-label="Search currency pairs"
        />
      </div>

      {/* Pair groups */}
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {group.pairs.map((p) => {
              const isSelected = pair === p.value
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => onSelect(p.value)}
                  aria-pressed={isSelected}
                  className={`group relative flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary shadow-primary/20 scale-[1.02] shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  }`}
                >
                  <span className="text-base" aria-hidden="true">
                    {getPairFlags(p.value)}
                  </span>
                  <span>{p.label}</span>
                  {isSelected && (
                    <span className="bg-primary text-primary-foreground absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full text-[10px]">
                      ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
