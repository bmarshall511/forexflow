"use client"

import { cn } from "@/lib/utils"

export interface OverlayVisibility {
  entry: boolean
  stopLoss: boolean
  takeProfit: boolean
  exit: boolean
  zones: boolean
}

interface ReplayOverlayLegendProps {
  visibility: OverlayVisibility
  onToggle: (key: keyof OverlayVisibility) => void
  hasZones: boolean
  hasSL: boolean
  hasTP: boolean
}

interface LegendItem {
  key: keyof OverlayVisibility
  label: string
  plainLabel: string
  color: string
  requires?: "hasSL" | "hasTP" | "hasZones"
}

const ITEMS: LegendItem[] = [
  { key: "entry", label: "Entry", plainLabel: "Entry Price", color: "bg-amber-500" },
  {
    key: "stopLoss",
    label: "SL",
    plainLabel: "Safety Exit",
    color: "bg-red-500",
    requires: "hasSL",
  },
  {
    key: "takeProfit",
    label: "TP",
    plainLabel: "Profit Target",
    color: "bg-emerald-500",
    requires: "hasTP",
  },
  { key: "exit", label: "Exit", plainLabel: "Exit Price", color: "bg-purple-500" },
  {
    key: "zones",
    label: "Zones",
    plainLabel: "Trade Zones",
    color: "bg-blue-500",
    requires: "hasZones",
  },
]

export function ReplayOverlayLegend({
  visibility,
  onToggle,
  hasZones,
  hasSL,
  hasTP,
}: ReplayOverlayLegendProps) {
  const flags = { hasSL, hasTP, hasZones }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-muted-foreground mr-1 text-[10px]">Show:</span>
      {ITEMS.map((item) => {
        if (item.requires && !flags[item.requires]) return null
        const active = visibility[item.key]
        return (
          <button
            key={item.key}
            onClick={() => onToggle(item.key)}
            className={cn(
              "inline-flex min-h-[28px] items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground/50 hover:text-muted-foreground",
            )}
            aria-label={`${active ? "Hide" : "Show"} ${item.plainLabel}`}
            aria-pressed={active}
          >
            <span
              className={cn(
                "size-2 rounded-full transition-opacity",
                item.color,
                !active && "opacity-30",
              )}
            />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
