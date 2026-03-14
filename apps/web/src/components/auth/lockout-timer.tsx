"use client"

import { useEffect, useState } from "react"
import { ShieldAlert } from "lucide-react"

interface LockoutTimerProps {
  /** Lockout remaining in milliseconds */
  lockoutMs: number
  /** Called when the lockout expires */
  onExpire: () => void
}

export function LockoutTimer({ lockoutMs, onExpire }: LockoutTimerProps) {
  const [remainingMs, setRemainingMs] = useState(lockoutMs)

  useEffect(() => {
    setRemainingMs(lockoutMs)
  }, [lockoutMs])

  useEffect(() => {
    if (remainingMs <= 0) {
      onExpire()
      return
    }

    const timer = setInterval(() => {
      setRemainingMs((prev) => {
        const next = prev - 1000
        if (next <= 0) {
          clearInterval(timer)
          onExpire()
          return 0
        }
        return next
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [remainingMs, onExpire])

  const minutes = Math.floor(remainingMs / 60000)
  const seconds = Math.floor((remainingMs % 60000) / 1000)
  const display = `${minutes}:${seconds.toString().padStart(2, "0")}`

  return (
    <div className="flex flex-col items-center gap-3 text-center" role="alert">
      <div className="bg-destructive/10 flex h-14 w-14 items-center justify-center rounded-full">
        <ShieldAlert className="text-destructive h-7 w-7" />
      </div>
      <div>
        <p className="text-destructive text-sm font-medium">Account Locked</p>
        <p className="text-muted-foreground mt-1 text-xs">Too many failed attempts</p>
      </div>
      <div className="text-foreground text-2xl font-semibold tabular-nums tracking-wider">
        {display}
      </div>
      <p className="text-muted-foreground text-xs">Try again when the timer expires</p>
    </div>
  )
}
