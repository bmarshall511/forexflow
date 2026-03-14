import type { AnalyticsFilters } from "@fxflow/types"

/**
 * Parse analytics filter query params shared by all analytics routes.
 * Returns an AnalyticsFilters object (undefined fields are omitted).
 */
export function parseAnalyticsFilters(params: URLSearchParams): AnalyticsFilters {
  const filters: AnalyticsFilters = {}

  const dateFrom = params.get("dateFrom")
  if (dateFrom) {
    const d = new Date(dateFrom)
    if (!Number.isNaN(d.getTime())) filters.dateFrom = d
  }

  const dateTo = params.get("dateTo")
  if (dateTo) {
    const d = new Date(dateTo)
    if (!Number.isNaN(d.getTime())) filters.dateTo = d
  }

  const instrument = params.get("instrument")
  if (instrument) filters.instrument = instrument

  const source = params.get("source")
  if (source) filters.source = source

  const direction = params.get("direction")
  if (direction === "long" || direction === "short") filters.direction = direction

  return filters
}
