"use client"

import { useCallback } from "react"
import type { AnalyticsFilters } from "@fxflow/types"

interface Props {
  filters: AnalyticsFilters
  onChange: (filters: AnalyticsFilters) => void
}

function toInputDate(d?: Date): string {
  if (!d) return ""
  return d.toISOString().slice(0, 10)
}

export function AnalyticsFilterBar({ filters, onChange }: Props) {
  const setField = useCallback(
    <K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) => {
      onChange({ ...filters, [key]: value })
    },
    [filters, onChange],
  )

  return (
    <div
      className="flex flex-wrap items-end gap-3"
      role="search"
      aria-label="Filter analytics data"
    >
      <div className="space-y-1">
        <label htmlFor="af-from" className="text-muted-foreground text-[11px] font-medium">
          From
        </label>
        <input
          id="af-from"
          type="date"
          value={toInputDate(filters.dateFrom)}
          onChange={(e) => {
            const v = e.target.value
            setField("dateFrom", v ? new Date(v + "T00:00:00Z") : undefined)
          }}
          className="bg-muted/50 border-input h-9 rounded-md border px-2.5 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="af-to" className="text-muted-foreground text-[11px] font-medium">
          To
        </label>
        <input
          id="af-to"
          type="date"
          value={toInputDate(filters.dateTo)}
          onChange={(e) => {
            const v = e.target.value
            setField("dateTo", v ? new Date(v + "T23:59:59Z") : undefined)
          }}
          className="bg-muted/50 border-input h-9 rounded-md border px-2.5 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="af-direction" className="text-muted-foreground text-[11px] font-medium">
          Direction
        </label>
        <select
          id="af-direction"
          value={filters.direction ?? ""}
          onChange={(e) => {
            const v = e.target.value as "long" | "short" | ""
            setField("direction", v || undefined)
          }}
          className="bg-muted/50 border-input h-9 rounded-md border px-2.5 text-sm"
        >
          <option value="">All</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
      </div>
      {(filters.dateFrom || filters.dateTo || filters.direction) && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="text-muted-foreground hover:text-foreground h-9 px-2 text-xs underline transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
