"use client"

import { type ReactNode, useState } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { cn } from "@/lib/utils"

interface PageErrorBoundaryProps {
  children: ReactNode
  className?: string
}

function PageErrorFallback({ onReload }: { onReload: () => void }) {
  const isDev = process.env.NODE_ENV === "development"

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="text-destructive size-12" aria-hidden="true" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        {isDev && (
          <p className="text-muted-foreground max-w-lg text-sm">
            Check the browser console for error details.
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onReload}>
          Reload Page
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}

/**
 * Page-level error boundary with a full-page centered fallback.
 * Reload remounts the entire subtree by re-keying the inner boundary.
 */
export function PageErrorBoundary({ children, className }: PageErrorBoundaryProps) {
  const [resetKey, setResetKey] = useState(0)

  return (
    <div className={cn(className)}>
      <ErrorBoundary
        key={resetKey}
        fallback={<PageErrorFallback onReload={() => setResetKey((k) => k + 1)} />}
      >
        {children}
      </ErrorBoundary>
    </div>
  )
}
