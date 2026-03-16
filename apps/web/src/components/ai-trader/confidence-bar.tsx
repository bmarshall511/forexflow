"use client"

import { cn } from "@/lib/utils"

interface ConfidenceBarProps {
  confidence: number
  className?: string
}

export function ConfidenceBar({ confidence, className }: ConfidenceBarProps) {
  const clamped = Math.max(0, Math.min(100, confidence))
  const color = clamped >= 80 ? "bg-emerald-500" : clamped >= 60 ? "bg-amber-500" : "bg-red-500"

  return (
    <div
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Confidence: ${clamped}%`}
      className={cn("bg-muted h-2 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
