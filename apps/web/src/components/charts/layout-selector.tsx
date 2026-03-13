"use client"

import { useState, useRef, useEffect } from "react"
import type { ChartGridLayout } from "@fxflow/types"
import { cn } from "@/lib/utils"

/** Small CSS grid icon preview for each layout */
function LayoutIcon({ layout, size = "sm" }: { layout: ChartGridLayout; size?: "sm" | "md" }) {
  const base = size === "md" ? "w-8 h-6 gap-[2px]" : "w-5 h-4 gap-px"
  const cell = "bg-current rounded-[1px]"

  switch (layout) {
    case "single":
      return (
        <div className={cn(base, "grid grid-cols-1 grid-rows-1")}>
          <div className={cell} />
        </div>
      )
    case "2-horizontal":
      return (
        <div className={cn(base, "grid grid-cols-2 grid-rows-1")}>
          <div className={cell} />
          <div className={cell} />
        </div>
      )
    case "2-vertical":
      return (
        <div className={cn(base, "grid grid-cols-1 grid-rows-2")}>
          <div className={cell} />
          <div className={cell} />
        </div>
      )
    case "3-left":
      return (
        <div className={cn(base, "grid grid-cols-2 grid-rows-2")}>
          <div className={cn(cell, "row-span-2")} />
          <div className={cell} />
          <div className={cell} />
        </div>
      )
    case "4-grid":
      return (
        <div className={cn(base, "grid grid-cols-2 grid-rows-2")}>
          <div className={cell} />
          <div className={cell} />
          <div className={cell} />
          <div className={cell} />
        </div>
      )
    case "6-grid":
      return (
        <div className={cn(base, "grid grid-cols-3 grid-rows-2")}>
          <div className={cell} />
          <div className={cell} />
          <div className={cell} />
          <div className={cell} />
          <div className={cell} />
          <div className={cell} />
        </div>
      )
  }
}

const LAYOUTS: { value: ChartGridLayout; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "2-horizontal", label: "2 Horizontal" },
  { value: "2-vertical", label: "2 Vertical" },
  { value: "3-left", label: "1 + 2" },
  { value: "4-grid", label: "2 × 2" },
  { value: "6-grid", label: "2 × 3" },
]

interface LayoutSelectorProps {
  value: ChartGridLayout
  onChange: (layout: ChartGridLayout) => void
}

export function LayoutSelector({ value, onChange }: LayoutSelectorProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors text-muted-foreground",
          "hover:bg-muted hover:text-foreground border border-transparent",
          open && "bg-muted text-foreground border-border",
        )}
        aria-label="Select chart layout"
        aria-expanded={open}
      >
        <LayoutIcon layout={value} />
        <span className="hidden sm:inline">Layout</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 rounded-lg border bg-popover shadow-lg p-1.5 min-w-[180px]">
          {LAYOUTS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={cn(
                "flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-xs transition-colors",
                opt.value === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <LayoutIcon layout={opt.value} size="md" />
              <span className="font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
