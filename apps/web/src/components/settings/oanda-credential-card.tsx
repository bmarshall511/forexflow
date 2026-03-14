"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CredentialForm } from "@/components/settings/credential-form"
import { cn } from "@/lib/utils"
import type { TradingMode, OandaCredentials } from "@fxflow/types"

interface OandaCredentialCardProps {
  mode: TradingMode
  credentials: OandaCredentials
  onCredentialsChange: (credentials: OandaCredentials) => void
}

export function OandaCredentialCard({
  mode,
  credentials,
  onCredentialsChange,
}: OandaCredentialCardProps) {
  const isLive = mode === "live"

  return (
    <Card className={cn("transition-colors", isLive && "border-status-connected/20")}>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              isLive ? "bg-status-connected" : "bg-status-warning",
            )}
            aria-hidden="true"
          />
          <CardTitle className="text-base">{isLive ? "Live" : "Practice"} Credentials</CardTitle>
        </div>
        <CardDescription>
          {isLive
            ? "Credentials for your live OANDA trading account. Use with caution — trades use real funds."
            : "Credentials for your practice OANDA account. Safe for testing strategies."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CredentialForm
          mode={mode}
          credentials={credentials}
          onCredentialsChange={onCredentialsChange}
        />
      </CardContent>
    </Card>
  )
}
