"use client"

import { cn } from "@/lib/utils"

interface ScoreGaugeProps {
  score: number
  max: number
  /** Diameter in px (default 56) */
  size?: number
  className?: string
}

/**
 * Circular SVG gauge displaying a score out of a maximum.
 * Color adapts: green >= 75%, amber >= 58%, orange below.
 */
export function ScoreGauge({ score, max, size = 56, className }: ScoreGaugeProps) {
  const pct = max > 0 ? score / max : 0
  const strokeWidth = 3.5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - pct)

  const strokeColor =
    pct >= 0.75 ? "stroke-green-500" : pct >= 0.58 ? "stroke-amber-500" : "stroke-orange-500"

  const textColor =
    pct >= 0.75 ? "text-green-500" : pct >= 0.58 ? "text-amber-500" : "text-orange-500"

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`Score ${score} out of ${max}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        {/* Filled arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={cn(strokeColor, "transition-[stroke-dashoffset] duration-500")}
        />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-sm font-bold tabular-nums leading-none", textColor)}>
          {score % 1 === 0 ? score : score.toFixed(1)}
        </span>
        <span className="text-muted-foreground text-[9px] leading-none">/{max}</span>
      </div>
    </div>
  )
}
