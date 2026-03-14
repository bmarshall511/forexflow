"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ShieldCheck, ArrowLeft } from "lucide-react"
import { PinPad } from "@/components/auth/pin-pad"
import { PinDots } from "@/components/auth/pin-dots"
import { Button } from "@/components/ui/button"

const PIN_LENGTH = 6

type SetupStep = "welcome" | "create" | "confirm"

function Logo({ size = "lg" }: { size?: "sm" | "lg" }) {
  const width = size === "lg" ? 220 : 160
  const height = size === "lg" ? 54 : 40

  return (
    <>
      <Image
        src="/logo-white.png"
        alt="FXFlow"
        width={width}
        height={height}
        className="hidden dark:block"
        priority
      />
      <Image
        src="/logo-black.png"
        alt="FXFlow"
        width={width}
        height={height}
        className="block dark:hidden"
        priority
      />
    </>
  )
}

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<SetupStep>("welcome")
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [loading, setLoading] = useState(false)

  const handleCreateDigit = useCallback(
    (digit: string) => {
      setError(false)
      setErrorMessage("")
      const next = pin + digit
      setPin(next)
      if (next.length >= PIN_LENGTH) {
        // Move to confirm step
        setTimeout(() => {
          setStep("confirm")
        }, 200)
      }
    },
    [pin],
  )

  const handleConfirmDigit = useCallback(
    (digit: string) => {
      setError(false)
      setErrorMessage("")
      const next = confirmPin + digit
      setConfirmPin(next)
      if (next.length >= PIN_LENGTH) {
        if (next !== pin) {
          setError(true)
          setErrorMessage("PINs don't match. Try again.")
          setTimeout(() => {
            setConfirmPin("")
            setError(false)
          }, 800)
          return
        }
        // Submit
        void submitPin(next)
      }
    },
    [confirmPin, pin],
  )

  const submitPin = async (finalPin: string) => {
    setLoading(true)
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: finalPin }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (json.ok) {
        router.replace("/")
      } else {
        setError(true)
        setErrorMessage(json.error ?? "Failed to create PIN")
        setConfirmPin("")
      }
    } catch {
      setError(true)
      setErrorMessage("Connection error")
      setConfirmPin("")
    } finally {
      setLoading(false)
    }
  }

  if (step === "welcome") {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <Logo size="lg" />
        <div>
          <h1 className="text-2xl font-semibold">Welcome to FXFlow</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Your forex trading platform. Let&apos;s secure your account with a PIN before getting
            started.
          </p>
        </div>
        <div className="border-border/50 bg-card flex items-center gap-3 rounded-lg border p-4 text-left">
          <ShieldCheck className="text-primary h-5 w-5 shrink-0" />
          <p className="text-muted-foreground text-xs">
            Your PIN protects access to your trading dashboard, positions, and account settings. You
            can change it anytime from Settings.
          </p>
        </div>
        <Button className="w-full" size="lg" onClick={() => setStep("create")}>
          Create PIN
        </Button>
      </div>
    )
  }

  if (step === "create") {
    return (
      <div className="flex w-full max-w-xs flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-4">
          <Logo size="sm" />
          <div className="text-center">
            <h1 className="text-lg font-semibold">Create your PIN</h1>
            <p className="text-muted-foreground text-sm">Choose a {PIN_LENGTH}-digit PIN</p>
          </div>
        </div>

        <PinDots length={PIN_LENGTH} filled={pin.length} />

        <div className="h-5" />

        <PinPad
          onDigit={handleCreateDigit}
          onBackspace={() => setPin((prev) => prev.slice(0, -1))}
          disabled={pin.length >= PIN_LENGTH}
        />
      </div>
    )
  }

  // Confirm step
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-4">
        <Logo size="sm" />
        <div className="text-center">
          <h1 className="text-lg font-semibold">Confirm your PIN</h1>
          <p className="text-muted-foreground text-sm">Re-enter your {PIN_LENGTH}-digit PIN</p>
        </div>
      </div>

      <PinDots length={PIN_LENGTH} filled={confirmPin.length} error={error} />

      <div className="h-5 text-center">
        {errorMessage && (
          <p className="text-destructive text-xs font-medium" role="alert">
            {errorMessage}
          </p>
        )}
      </div>

      <PinPad
        onDigit={handleConfirmDigit}
        onBackspace={() => {
          setError(false)
          setErrorMessage("")
          setConfirmPin((prev) => prev.slice(0, -1))
        }}
        disabled={loading || confirmPin.length >= PIN_LENGTH}
      />

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground mt-2 gap-1.5"
        onClick={() => {
          setPin("")
          setConfirmPin("")
          setError(false)
          setErrorMessage("")
          setStep("create")
        }}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Start over
      </Button>
    </div>
  )
}
