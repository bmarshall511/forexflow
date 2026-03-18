"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, X, CreditCard, Wifi, Clock, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AiErrorData {
  category: string
  message: string
  source: string
  retryable: boolean
}

type IconComponent = typeof AlertTriangle

const CATEGORY_CONFIG: Record<
  string,
  {
    icon: IconComponent
    color: string
    action?: { label: string; href: string; external?: boolean }
  }
> = {
  quota_exceeded: {
    icon: CreditCard,
    color: "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400",
    action: {
      label: "Check billing",
      href: "https://console.anthropic.com/settings/billing",
      external: true,
    },
  },
  invalid_key: {
    icon: Key,
    color: "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400",
    action: { label: "Update API key", href: "/settings/ai" },
  },
  rate_limited: {
    icon: Clock,
    color: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
  },
  overloaded: {
    icon: Clock,
    color: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
  },
  network: {
    icon: Wifi,
    color: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
  },
}

const DEFAULT_CONFIG = {
  icon: AlertTriangle,
  color: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
} as const

export function AiErrorBanner() {
  const [error, setError] = useState<AiErrorData | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent<AiErrorData>).detail
      if (data) {
        setError(data)
        setDismissed(false)
      }
    }
    window.addEventListener("ai-error-alert", handler)
    return () => window.removeEventListener("ai-error-alert", handler)
  }, [])

  // Auto-clear retryable errors after 30s
  useEffect(() => {
    if (!error?.retryable) return
    const timer = setTimeout(() => setError(null), 30_000)
    return () => clearTimeout(timer)
  }, [error])

  if (!error || dismissed) return null

  const config = CATEGORY_CONFIG[error.category] ?? DEFAULT_CONFIG
  const Icon = config.icon

  return (
    <div
      className={cn("border-b px-4 py-2", config.color)}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-center gap-2 text-xs">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="font-medium">{error.message}</span>
        {"action" in config &&
          config.action != null &&
          ("external" in config.action && config.action.external ? (
            <a
              href={config.action.href}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 underline underline-offset-2"
            >
              {config.action.label} ↗
            </a>
          ) : (
            <Link href={config.action.href} className="ml-1 underline underline-offset-2">
              {config.action.label}
            </Link>
          ))}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-5 w-5 p-0"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss AI error"
        >
          <X className="size-3" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
