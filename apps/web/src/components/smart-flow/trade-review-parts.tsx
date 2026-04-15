"use client"

/**
 * Presentational building blocks shared across the Trade Review drawer:
 * `SectionHeader`, `ContextRow`, and `Tile`. Extracted from
 * `trade-review-body.tsx` to keep every component file under the
 * ≤150-LOC rule.
 */

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase tracking-wider">
      {children}
    </h3>
  )
}

export function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

export function Tile({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string
  value: string
  sub?: string
  valueColor?: string
}) {
  return (
    <div className="bg-muted/50 rounded-md px-3 py-2">
      <p className="text-muted-foreground text-[10px] uppercase tracking-wide">{label}</p>
      <p className={cn("text-sm font-semibold tabular-nums", valueColor)}>{value}</p>
      {sub && <p className="text-muted-foreground text-[10px] tabular-nums">{sub}</p>}
    </div>
  )
}
