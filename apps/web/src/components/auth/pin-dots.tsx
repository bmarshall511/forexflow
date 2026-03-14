"use client"

interface PinDotsProps {
  /** Total number of PIN digits expected */
  length: number
  /** Number of digits currently entered */
  filled: number
  /** Show error shake animation */
  error?: boolean
}

export function PinDots({ length, filled, error }: PinDotsProps) {
  return (
    <div
      className={`flex items-center justify-center gap-3 ${error ? "animate-shake" : ""}`}
      role="status"
      aria-label={`${filled} of ${length} digits entered`}
    >
      {Array.from({ length }, (_, i) => (
        <div
          key={i}
          className={`h-3.5 w-3.5 rounded-full border-2 transition-all duration-150 ${
            i < filled
              ? "border-primary bg-primary scale-110"
              : "border-muted-foreground/40 bg-transparent"
          }`}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}
