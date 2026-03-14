"use client"

import { cn } from "@/lib/utils"

interface ProgressRingProps {
  /** 0–100 percentage */
  value: number
  /** Pixel size of the ring */
  size?: number
  /** Stroke width */
  strokeWidth?: number
  /** Override color thresholds: green < warn < red */
  warnAt?: number
  dangerAt?: number
  className?: string
  children?: React.ReactNode
}

/**
 * Circular gauge for displaying percentages like margin usage.
 * Color shifts from green → amber → red as value increases.
 */
export function ProgressRing({
  value,
  size = 56,
  strokeWidth = 5,
  warnAt = 30,
  dangerAt = 60,
  className,
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(Math.max(value, 0), 100)
  const offset = circumference * (1 - clamped / 100)

  const color =
    clamped >= dangerAt
      ? "stroke-status-disconnected"
      : clamped >= warnAt
        ? "stroke-status-warning"
        : "stroke-status-connected"

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      role="meter"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${Math.round(clamped)}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn("transition-all duration-500 ease-out", color)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute flex flex-col items-center">
        {children ?? (
          <span className="font-mono text-xs font-semibold tabular-nums">
            {Math.round(clamped)}%
          </span>
        )}
      </span>
    </div>
  )
}
