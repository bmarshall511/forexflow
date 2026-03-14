"use client"

import { useState } from "react"
import { OnboardingWizard } from "./onboarding-wizard"

interface OnboardingGateProps {
  showOnboarding: boolean
  children: React.ReactNode
}

/**
 * Wraps the app shell. If onboarding is not completed, renders the wizard overlay
 * on top of the children (app is still visible behind the backdrop).
 */
export function OnboardingGate({ showOnboarding, children }: OnboardingGateProps) {
  const [dismissed, setDismissed] = useState(false)

  return (
    <>
      {children}
      {showOnboarding && !dismissed && <OnboardingWizard onComplete={() => setDismissed(true)} />}
    </>
  )
}
