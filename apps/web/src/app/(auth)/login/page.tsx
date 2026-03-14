"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { PinPad } from "@/components/auth/pin-pad"
import { PinDots } from "@/components/auth/pin-dots"
import { LockoutTimer } from "@/components/auth/lockout-timer"

const PIN_LENGTH = 6

function Logo() {
  return (
    <>
      <Image
        src="/logo-white.png"
        alt="FXFlow"
        width={180}
        height={44}
        className="hidden dark:block"
        priority
      />
      <Image
        src="/logo-black.png"
        alt="FXFlow"
        width={180}
        height={44}
        className="block dark:hidden"
        priority
      />
    </>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") ?? "/"

  const [pin, setPin] = useState("")
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [lockoutMs, setLockoutMs] = useState(0)

  const handleSubmit = useCallback(
    async (fullPin: string) => {
      if (loading) return
      setLoading(true)
      setError(false)
      setErrorMessage("")

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: fullPin }),
        })

        const json = (await res.json()) as {
          ok: boolean
          error?: string
          data?: { locked?: boolean; lockoutRemainingMs?: number; attemptsRemaining?: number }
        }

        if (json.ok) {
          router.replace(redirect)
          return
        }

        if (json.data?.locked && json.data.lockoutRemainingMs) {
          setLockoutMs(json.data.lockoutRemainingMs)
          setPin("")
          setLoading(false)
          return
        }

        setError(true)
        setPin("")
        const remaining = json.data?.attemptsRemaining
        setErrorMessage(
          remaining !== undefined && remaining > 0
            ? `Incorrect PIN \u2014 ${remaining} attempt${remaining === 1 ? "" : "s"} remaining`
            : (json.error ?? "Incorrect PIN"),
        )
      } catch {
        setError(true)
        setErrorMessage("Connection error")
      } finally {
        setLoading(false)
      }
    },
    [loading, redirect, router],
  )

  const handleDigit = useCallback(
    (digit: string) => {
      if (lockoutMs > 0) return
      setError(false)
      setErrorMessage("")
      const next = pin + digit
      setPin(next)
      if (next.length >= PIN_LENGTH) {
        void handleSubmit(next)
      }
    },
    [pin, lockoutMs, handleSubmit],
  )

  const handleBackspace = useCallback(() => {
    setError(false)
    setErrorMessage("")
    setPin((prev) => prev.slice(0, -1))
  }, [])

  if (lockoutMs > 0) {
    return (
      <div className="flex w-full max-w-xs flex-col items-center gap-10">
        <Logo />
        <LockoutTimer
          lockoutMs={lockoutMs}
          onExpire={() => {
            setLockoutMs(0)
            setErrorMessage("")
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-8">
      {/* Logo */}
      <div className="flex flex-col items-center gap-4">
        <Logo />
        <p className="text-muted-foreground text-sm">Enter your PIN to continue</p>
      </div>

      {/* PIN dots */}
      <PinDots length={PIN_LENGTH} filled={pin.length} error={error} />

      {/* Error message */}
      <div className="h-5 text-center">
        {errorMessage && (
          <p className="text-destructive text-xs font-medium" role="alert">
            {errorMessage}
          </p>
        )}
      </div>

      {/* Keypad */}
      <PinPad
        onDigit={handleDigit}
        onBackspace={handleBackspace}
        disabled={loading || pin.length >= PIN_LENGTH}
      />
    </div>
  )
}
