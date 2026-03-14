"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.ComponentProps<"div"> {
  value?: number
  max?: number
  indicatorClassName?: string
}

function Progress({
  className,
  value = 0,
  max = 100,
  indicatorClassName,
  ...props
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("bg-muted relative h-2 w-full overflow-hidden rounded-full", className)}
      {...props}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500 ease-out",
          indicatorClassName ?? "bg-primary",
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export { Progress }
