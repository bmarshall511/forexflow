"use client"

import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type SortDirection = "asc" | "desc" | null

export interface SortState {
  key: string
  direction: SortDirection
}

interface SortableHeadProps {
  label: string
  sortKey: string
  currentSort: SortState
  onSort: (key: string) => void
  className?: string
  /** Tooltip shown on hover (use for abbreviated labels) */
  title?: string
}

export function SortableHead({ label, sortKey, currentSort, onSort, className, title }: SortableHeadProps) {
  const isActive = currentSort.key === sortKey
  const direction = isActive ? currentSort.direction : null

  return (
    <TableHead className={cn("text-xs", className)}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer select-none"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${title ?? label}`}
        title={title}
      >
        {label}
        {direction === "asc" ? (
          <ArrowUp className="size-3" />
        ) : direction === "desc" ? (
          <ArrowDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 opacity-30" />
        )}
      </button>
    </TableHead>
  )
}

/** Cycle sort: null → desc → asc → desc (no null reset, always sorted) */
export function nextSort(currentSort: SortState, key: string, defaultDir: SortDirection = "desc"): SortState {
  if (currentSort.key !== key) {
    return { key, direction: defaultDir }
  }
  return {
    key,
    direction: currentSort.direction === "desc" ? "asc" : "desc",
  }
}

/** Generic comparator for sortable tables. Handles strings, numbers, null. */
export function compareValues(a: unknown, b: unknown, direction: SortDirection): number {
  const dir = direction === "asc" ? 1 : -1

  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1

  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * dir
  }

  return String(a).localeCompare(String(b)) * dir
}
