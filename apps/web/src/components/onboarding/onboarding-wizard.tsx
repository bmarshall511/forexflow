"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { OnboardingWelcome } from "./onboarding-welcome"
import { OnboardingConnect } from "./onboarding-connect"
import { OnboardingFeatures } from "./onboarding-features"
import { OnboardingDone } from "./onboarding-done"
import { cn } from "@/lib/utils"

const STEPS = ["Welcome", "Connect", "Features", "Done"] as const
const TOTAL_STEPS = STEPS.length

interface OnboardingWizardProps {
  onComplete: () => void
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)

  const completeOnboarding = useCallback(async () => {
    try {
      await fetch("/api/settings/onboarding", { method: "PUT" })
    } catch {
      // Best-effort — user can still proceed
    }
    onComplete()
  }, [onComplete])

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1)
    } else {
      void completeOnboarding()
    }
  }

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1)
  }

  const handleSkip = () => {
    void completeOnboarding()
  }

  return (
    <div
      className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding wizard"
    >
      <div className="bg-card border-border relative flex w-full max-w-lg flex-col rounded-xl border shadow-lg">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 px-6 pt-6">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "focus-visible:ring-ring h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2",
                i === step ? "bg-primary w-6" : "bg-muted hover:bg-muted-foreground/30 w-2",
              )}
              aria-label={`Step ${i + 1}: ${label}`}
              aria-current={i === step ? "step" : undefined}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="px-6 py-8">
          {step === 0 && <OnboardingWelcome />}
          {step === 1 && <OnboardingConnect />}
          {step === 2 && <OnboardingFeatures />}
          {step === 3 && <OnboardingDone />}
        </div>

        {/* Navigation footer */}
        <div className="border-border flex items-center justify-between border-t px-6 py-4">
          <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
            Skip
          </Button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={handleBack}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {step === TOTAL_STEPS - 1 ? "Go to Dashboard" : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
