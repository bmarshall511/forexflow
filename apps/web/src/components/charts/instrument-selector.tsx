"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Search } from "lucide-react"
import { FOREX_PAIR_GROUPS, formatInstrument } from "@fxflow/shared"
import { cn } from "@/lib/utils"

interface InstrumentSelectorProps {
  value: string
  onChange: (instrument: string) => void
  className?: string
}

export function InstrumentSelector({ value, onChange, className }: InstrumentSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
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

  // Focus search when opening
  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      setSearch("")
    }
  }, [open])

  const lowerSearch = search.toLowerCase()
  const filteredGroups = FOREX_PAIR_GROUPS.map((group) => ({
    ...group,
    pairs: group.pairs.filter(
      (p) =>
        p.label.toLowerCase().includes(lowerSearch) || p.value.toLowerCase().includes(lowerSearch),
    ),
  })).filter((g) => g.pairs.length > 0)

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-muted flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-colors"
        aria-label="Select currency pair"
        aria-expanded={open}
      >
        {formatInstrument(value)}
        <ChevronDown className="text-muted-foreground h-3 w-3" />
      </button>

      {open && (
        <div className="bg-popover absolute left-0 top-full z-50 mt-1 w-48 rounded-md border shadow-md">
          <div className="p-1.5">
            <div className="bg-background flex items-center gap-1.5 rounded border px-1.5 py-1">
              <Search className="text-muted-foreground h-3 w-3 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search pairs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="placeholder:text-muted-foreground w-full bg-transparent text-xs outline-none"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto px-1 pb-1">
            {filteredGroups.map((group) => (
              <div key={group.label}>
                <div className="text-muted-foreground px-2 py-1 text-[10px] font-medium uppercase tracking-wider">
                  {group.label}
                </div>
                {group.pairs.map((pair) => (
                  <button
                    key={pair.value}
                    type="button"
                    onClick={() => {
                      onChange(pair.value)
                      setOpen(false)
                    }}
                    className={cn(
                      "w-full rounded px-2 py-1 text-left text-xs transition-colors",
                      pair.value === value
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted",
                    )}
                  >
                    {pair.label}
                  </button>
                ))}
              </div>
            ))}
            {filteredGroups.length === 0 && (
              <p className="text-muted-foreground px-2 py-3 text-center text-xs">No pairs found</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
