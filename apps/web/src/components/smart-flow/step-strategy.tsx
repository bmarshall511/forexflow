"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Check, ChevronDown, ChevronUp, Clock, Shield } from "lucide-react"
import type { SmartFlowPreset } from "@fxflow/types"
import { PRESET_INFO, PRESET_KEYS } from "./trade-builder-presets"

const BORDER_COLORS: Record<string, string> = {
  "text-emerald-500": "border-l-emerald-500",
  "text-amber-500": "border-l-amber-500",
  "text-red-500": "border-l-red-500",
}

export function StepStrategy({
  preset,
  onSelect,
}: {
  preset: Exclude<SmartFlowPreset, "custom">
  onSelect: (v: Exclude<SmartFlowPreset, "custom">) => void
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {PRESET_KEYS.map((key) => {
        const info = PRESET_INFO[key]
        const isRecovery = key === "recovery"
        const isRecommended = key === "steady_growth"
        const isSelected = preset === key
        const isExpanded = expandedKey === key
        const borderColor = BORDER_COLORS[info.riskColor] ?? "border-l-border"

        return (
          <div
            key={key}
            className={`overflow-hidden rounded-xl border-2 transition-all ${borderColor} border-l-4 ${
              isSelected
                ? "border-primary bg-primary/5 shadow-sm"
                : isRecovery
                  ? "border-amber-500/30 hover:border-amber-500/60"
                  : "border-border hover:border-primary/40"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(key)}
              aria-pressed={isSelected}
              className="flex min-h-[56px] w-full items-start gap-3 p-4 text-left"
            >
              <span className="mt-0.5 text-lg" aria-hidden="true">
                {info.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{info.label}</span>
                  <span className={`text-[10px] font-medium ${info.riskColor}`}>
                    {info.risk} risk
                  </span>
                  {isRecommended && (
                    <Badge variant="secondary" className="text-[10px]">
                      Recommended
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{info.desc}</p>
                <div className="mt-1.5 flex items-center gap-1 text-[10px]">
                  <Clock className="text-muted-foreground size-3" aria-hidden="true" />
                  <span className="text-muted-foreground">Typical hold: {info.holdTime}</span>
                </div>
              </div>
              {isSelected && <Check className="text-primary mt-0.5 size-5 shrink-0" />}
            </button>

            {/* Expandable details */}
            <div className="border-border/50 border-t px-4 py-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setExpandedKey(isExpanded ? null : key)
                }}
                className="text-muted-foreground hover:text-foreground flex min-h-[36px] w-full items-center gap-1.5 text-left text-[11px] font-medium transition-colors"
                aria-expanded={isExpanded}
              >
                <Shield className="size-3" aria-hidden="true" />
                What this means
                {isExpanded ? (
                  <ChevronUp className="ml-auto size-3" />
                ) : (
                  <ChevronDown className="ml-auto size-3" />
                )}
              </button>
              {isExpanded && (
                <ul className="space-y-1 pb-3" aria-label={`${info.label} protections`}>
                  {info.protections.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span className="mt-0.5 shrink-0 text-emerald-500">&#x2713;</span>
                      <span className="text-muted-foreground">{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Recovery warning */}
            {isRecovery && isSelected && (
              <div className="border-t border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
                <p className="text-[11px] font-medium text-amber-400">
                  Warning: Recovery Mode can multiply your losses. Only use if you understand
                  position averaging and are comfortable with the risk.
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
