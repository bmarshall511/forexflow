"use client"

import { SecurityPinSection } from "@/components/settings/security-pin-section"
import { SecuritySessionSection } from "@/components/settings/security-session-section"
import { SecurityRemoteSection } from "@/components/settings/security-remote-section"

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6">
      <SecurityPinSection />
      <SecuritySessionSection />
      <SecurityRemoteSection />
    </div>
  )
}
