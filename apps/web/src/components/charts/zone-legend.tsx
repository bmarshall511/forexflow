"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface ZoneLegendProps {
  showHigherTf: boolean
  showInvalidated: boolean
  className?: string
}

interface LegendItem {
  color: string
  label: string
  style: "solid" | "dashed" | "hatched"
}

export function ZoneLegend({ showHigherTf, showInvalidated, className }: ZoneLegendProps) {
  const [expanded, setExpanded] = useState(false)

  const items: LegendItem[] = [
    { color: "#22c55e", label: "Demand Zone", style: "solid" },
    { color: "#ef4444", label: "Supply Zone", style: "solid" },
  ]

  if (showHigherTf) {
    items.push(
      { color: "#16a34a", label: "HTF Demand", style: "dashed" },
      { color: "#dc2626", label: "HTF Supply", style: "dashed" },
    )
  }

  if (showInvalidated) {
    items.push({ color: "#6b7280", label: "Invalidated", style: "hatched" })
  }

  return (
    <div className={cn("inline-flex", className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors"
        aria-expanded={expanded}
        aria-label="Toggle zone legend"
      >
        <svg
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
        {!expanded && <span>Legend</span>}
      </button>

      {expanded && (
        <div className="animate-in fade-in slide-in-from-left-2 ml-1 flex items-center gap-2.5 duration-150">
          {items.map((item) => (
            <LegendEntry key={item.label} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function LegendEntry({ item }: { item: LegendItem }) {
  return (
    <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
      <span
        className="inline-block h-2 w-4 shrink-0 rounded-sm"
        style={{
          backgroundColor: `${item.color}20`,
          border: `1px ${item.style === "dashed" ? "dashed" : "solid"} ${item.color}80`,
          backgroundImage:
            item.style === "hatched"
              ? `repeating-linear-gradient(45deg, transparent, transparent 2px, ${item.color}15 2px, ${item.color}15 4px)`
              : undefined,
        }}
      />
      <span>{item.label}</span>
    </span>
  )
}
