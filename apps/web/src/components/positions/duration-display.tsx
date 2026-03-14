"use client"

import { useState, useEffect } from "react"
import { formatDuration } from "@fxflow/shared"

interface DurationDisplayProps {
  openedAt: string
  closedAt?: string | null
  className?: string
}

export function DurationDisplay({ openedAt, closedAt, className }: DurationDisplayProps) {
  const [now, setNow] = useState(Date.now)

  // For open trades, update every minute
  useEffect(() => {
    if (closedAt) return
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [closedAt])

  const endTime = closedAt ? new Date(closedAt).getTime() : now
  const duration = endTime - new Date(openedAt).getTime()

  return <span className={className}>{formatDuration(duration)}</span>
}
