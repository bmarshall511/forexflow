"use client"

import { type ReactNode, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { cn } from "@/lib/utils"

interface CardErrorBoundaryProps {
  children: ReactNode
  className?: string
}

function CardErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-destructive/20">
      <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <AlertTriangle className="text-muted-foreground size-5" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">Failed to load</p>
        <Button variant="ghost" size="xs" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * Error boundary sized for dashboard cards. Renders a compact fallback
 * that fits within a card grid cell. Re-keys the inner ErrorBoundary
 * on retry to force a full remount of children.
 */
export function CardErrorBoundary({ children, className }: CardErrorBoundaryProps) {
  const [resetKey, setResetKey] = useState(0)

  return (
    <div className={cn(className)}>
      <ErrorBoundary
        key={resetKey}
        fallback={<CardErrorFallback onRetry={() => setResetKey((k) => k + 1)} />}
      >
        {children}
      </ErrorBoundary>
    </div>
  )
}
