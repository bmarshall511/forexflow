"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AiTraderOpportunityStatus, AiTraderProfile, TradeDirection } from "@fxflow/types"

export interface OpportunityFilterState {
  status: AiTraderOpportunityStatus[]
  profile: AiTraderProfile | null
  direction: TradeDirection | null
  search: string
  sort: "confidence" | "detectedAt" | "realizedPL" | "riskRewardRatio"
  sortDir: "asc" | "desc"
}

interface Props {
  filters: OpportunityFilterState
  onChange: (filters: OpportunityFilterState) => void
}

const STATUSES: { value: AiTraderOpportunityStatus; label: string }[] = [
  { value: "suggested", label: "Suggested" },
  { value: "placed", label: "Placed" },
  { value: "filled", label: "Filled" },
  { value: "closed", label: "Closed" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "skipped", label: "Skipped" },
]

const SORTS: { value: OpportunityFilterState["sort"]; label: string }[] = [
  { value: "detectedAt", label: "Date" },
  { value: "confidence", label: "Confidence" },
  { value: "realizedPL", label: "P&L" },
  { value: "riskRewardRatio", label: "R:R" },
]

export function OpportunityFilters({ filters, onChange }: Props) {
  const [searchInput, setSearchInput] = useState(filters.search)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value)
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onChange({ ...filters, search: value })
      }, 300)
    },
    [filters, onChange],
  )

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const toggleStatus = (s: AiTraderOpportunityStatus) => {
    const current = filters.status
    const next = current.includes(s) ? current.filter((x) => x !== s) : [...current, s]
    onChange({ ...filters, status: next })
  }

  const hasFilters =
    filters.status.length > 0 ||
    filters.profile !== null ||
    filters.direction !== null ||
    filters.search !== ""

  return (
    <div className="space-y-3">
      {/* Search + Sort row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
          <Input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search instrument, rationale, technique..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <select
          value={`${filters.sort}-${filters.sortDir}`}
          onChange={(e) => {
            const [sort, dir] = e.target.value.split("-") as [
              OpportunityFilterState["sort"],
              "asc" | "desc",
            ]
            onChange({ ...filters, sort, sortDir: dir })
          }}
          className="bg-background border-border h-8 rounded-md border px-2 text-xs"
          aria-label="Sort order"
        >
          {SORTS.map((s) => (
            <option key={`${s.value}-desc`} value={`${s.value}-desc`}>
              {s.label} ↓
            </option>
          ))}
          {SORTS.map((s) => (
            <option key={`${s.value}-asc`} value={`${s.value}-asc`}>
              {s.label} ↑
            </option>
          ))}
        </select>
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => {
          const active = filters.status.includes(s.value)
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => toggleStatus(s.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          )
        })}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={() =>
              onChange({
                status: [],
                profile: null,
                direction: null,
                search: "",
                sort: "detectedAt",
                sortDir: "desc",
              })
            }
          >
            <X className="size-3" /> Clear
          </Button>
        )}
      </div>
    </div>
  )
}
