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
  const prefersReducedMotion = useRef(false)

  // Check prefers-reduced-motion once on mount and listen for changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    prefersReducedMotion.current = mq.matches

    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    if (prevValue.current !== value) {
      // Skip animation when reduced motion is preferred
      if (prefersReducedMotion.current) {
        setDisplayValue(value)
        prevValue.current = value
        return
      }

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
        "inline-block transition-opacity duration-300 motion-reduce:transition-none",
        isTransitioning ? "opacity-50" : "opacity-100",
        className,
      )}
      aria-live="polite"
    >
      {displayValue}
    </span>
  )
}
