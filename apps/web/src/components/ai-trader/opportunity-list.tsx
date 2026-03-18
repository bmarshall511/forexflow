"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { AiTraderOpportunityData } from "@fxflow/types"
import { OpportunityFilters, type OpportunityFilterState } from "./opportunity-filters"
import { OpportunityCompactCard } from "./opportunity-compact-card"
import { PipelineExplainer } from "./pipeline-explainer"

const PAGE_SIZE = 20

const DEFAULT_FILTERS: OpportunityFilterState = {
  status: [],
  profile: null,
  direction: null,
  search: "",
  sort: "detectedAt",
  sortDir: "desc",
}

export function OpportunityList() {
  const [filters, setFilters] = useState<OpportunityFilterState>(DEFAULT_FILTERS)
  const [data, setData] = useState<AiTraderOpportunityData[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  const fetchOpportunities = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status.length > 0) params.set("status", filters.status.join(","))
      if (filters.profile) params.set("profile", filters.profile)
      if (filters.direction) params.set("direction", filters.direction)
      if (filters.search) params.set("search", filters.search)
      params.set("sort", filters.sort)
      params.set("sortDir", filters.sortDir)
      params.set("page", String(page))
      params.set("limit", String(PAGE_SIZE))

      const res = await fetch(`/api/ai-trader/opportunities?${params}`)
      if (!res.ok) return
      const json = (await res.json()) as {
        ok: boolean
        data?: AiTraderOpportunityData[]
        total?: number
      }
      if (json.ok) {
        setData(json.data ?? [])
        setTotal(json.total ?? 0)
      }
    } catch {
      // API may be unavailable
    } finally {
      setIsLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    void fetchOpportunities()
  }, [fetchOpportunities])

  // Reset to page 1 when filters change
  const handleFilterChange = useCallback((next: OpportunityFilterState) => {
    setFilters(next)
    setPage(1)
  }, [])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      <PipelineExplainer />
      <OpportunityFilters filters={filters} onChange={handleFilterChange} />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center text-sm">
          No opportunities match the current filters.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((opp) => (
            <OpportunityCompactCard key={opp.id} opportunity={opp} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-muted-foreground text-xs tabular-nums">
            {total} total &middot; Page {page} of {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
