"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface AnimatedNumberProps {
  value: string
  className?: string
}

export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevValue = useRef(value)

  useEffect(() => {
    if (prevValue.current !== value) {
      setIsTransitioning(true)
      const timer = setTimeout(() => {
        setDisplayValue(value)
        setIsTransitioning(false)
        prevValue.current = value
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [value])

  return (
    <span
      className={cn(
        "inline-block transition-opacity duration-300",
        isTransitioning ? "opacity-50" : "opacity-100",
        className,
      )}
      aria-live="polite"
    >
      {displayValue}
    </span>
  )
}
