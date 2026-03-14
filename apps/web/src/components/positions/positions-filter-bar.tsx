"use client"

import type { TradeDirection, TradeOutcome, TagData } from "@fxflow/types"
import type { TradeHistoryFilters } from "@/hooks/use-positions-history"
import { cn } from "@/lib/utils"
import { SlidersHorizontal } from "lucide-react"

interface PositionsFilterBarProps {
  tab: "pending" | "open" | "history"
  instruments: string[]
  // For pending/open tab filtering
  instrumentFilter?: string
  directionFilter?: TradeDirection | ""
  onInstrumentChange?: (value: string) => void
  onDirectionChange?: (value: TradeDirection | "") => void
  // For history tab
  filters?: TradeHistoryFilters
  onFiltersChange?: (filters: TradeHistoryFilters) => void
  // Tags (available for all tabs)
  tags?: TagData[]
  // For pending/open tab tag filtering
  tagIds?: string[]
  onTagIdsChange?: (ids: string[]) => void
}

export function PositionsFilterBar({
  tab,
  instruments,
  instrumentFilter = "",
  directionFilter = "",
  onInstrumentChange,
  onDirectionChange,
  filters,
  onFiltersChange,
  tags,
  tagIds,
  onTagIdsChange,
}: PositionsFilterBarProps) {
  return (
    <div className="-mb-1 flex items-center gap-2.5 overflow-x-auto pb-1">
      <SlidersHorizontal className="text-muted-foreground size-3.5 shrink-0" />

      {/* Instrument filter */}
      <select
        className="border-border/60 bg-muted/30 focus:ring-ring/30 hover:bg-muted/50 h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2"
        value={tab === "history" ? (filters?.instrument ?? "") : instrumentFilter}
        onChange={(e) => {
          if (tab === "history") {
            onFiltersChange?.({ ...filters, instrument: e.target.value || undefined })
          } else {
            onInstrumentChange?.(e.target.value)
          }
        }}
        aria-label="Filter by instrument"
      >
        <option value="">All Pairs</option>
        {instruments.map((inst) => (
          <option key={inst} value={inst}>
            {inst.replace("_", "/")}
          </option>
        ))}
      </select>

      {/* Direction filter */}
      <PillGroup
        value={tab === "history" ? (filters?.direction ?? "") : directionFilter}
        onChange={(val) => {
          if (tab === "history") {
            onFiltersChange?.({ ...filters, direction: (val as TradeDirection) || undefined })
          } else {
            onDirectionChange?.(val as TradeDirection | "")
          }
        }}
        options={[
          { label: "All", value: "" },
          { label: "Buy", value: "long" },
          { label: "Sell", value: "short" },
        ]}
      />

      {/* History-specific outcome filter */}
      {tab === "history" && (
        <PillGroup
          value={filters?.outcome ?? ""}
          onChange={(val) =>
            onFiltersChange?.({ ...filters, outcome: (val as TradeOutcome) || undefined })
          }
          options={[
            { label: "All", value: "" },
            { label: "Win", value: "win" },
            { label: "Loss", value: "loss" },
            { label: "B/E", value: "breakeven" },
          ]}
        />
      )}

      {/* Tag filter pills */}
      {tags && tags.length > 0 && (
        <div className="border-border/40 ml-0.5 flex items-center gap-1.5 border-l pl-2.5">
          {tags.map((tag) => {
            const activeTagIds = tab === "history" ? (filters?.tagIds ?? []) : (tagIds ?? [])
            const active = activeTagIds.includes(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => {
                  const next = active
                    ? activeTagIds.filter((id) => id !== tag.id)
                    : [...activeTagIds, tag.id]
                  if (tab === "history") {
                    onFiltersChange?.({ ...filters, tagIds: next.length > 0 ? next : undefined })
                  } else {
                    onTagIdsChange?.(next)
                  }
                }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all",
                  active
                    ? "text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50",
                )}
                style={active ? { backgroundColor: tag.color } : undefined}
                aria-pressed={active}
              >
                {tag.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PillGroup({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: { label: string; value: string }[]
}) {
  return (
    <div className="bg-muted/40 inline-flex h-8 gap-0.5 rounded-lg p-0.5" role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={cn(
            "rounded-md px-2.5 text-xs font-medium transition-all",
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
