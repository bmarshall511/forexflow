"use client"

import Link from "next/link"
import { ArrowRight, type LucideIcon } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

/**
 * Drill-down drawer for dashboard KPIs.
 *
 * Used by hero tiles that want progressive disclosure: tap the tile →
 * drawer slides out with a plain-language definition, a period comparison
 * row, and an optional deep-link to the analytics page pre-filtered to
 * the same period.
 *
 * Parents control open/close and inject the rendered content so the
 * drawer stays dumb — no DB fetches or period plumbing here.
 */
export interface MetricDrawerPeriod {
  /** Label shown at the top of the column — "Today", "Week", etc. */
  label: string
  /** Pre-formatted display value. Free-form string / node so callers handle currency + sign. */
  value: React.ReactNode
  /** Optional subtitle under the value (e.g. trade count). */
  subtitle?: React.ReactNode
  /** Whether this column is the currently-selected period (gets a soft highlight). */
  current?: boolean
}

interface MetricDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  icon?: LucideIcon
  title: string
  /** Plain-English explanation — "what is this metric and why does it matter". */
  definition: React.ReactNode
  /** Short formula or citation — "wins / (wins + losses)" etc. Shown muted under definition. */
  formula?: React.ReactNode
  /** Comparison columns rendered side-by-side. Empty array hides the row. */
  periods?: MetricDrawerPeriod[]
  /** Optional deep-link to the analytics page with pre-filtered query. */
  analyticsHref?: string
  /** Any extra content (e.g. contributing trade list) rendered below the periods. */
  children?: React.ReactNode
}

export function MetricDrawer({
  open,
  onOpenChange,
  icon: Icon,
  title,
  definition,
  formula,
  periods,
  analyticsHref,
  children,
}: MetricDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {Icon && <Icon className="text-muted-foreground size-4" aria-hidden="true" />}
            {title}
          </SheetTitle>
          <SheetDescription asChild>
            <div className="text-muted-foreground space-y-1 text-sm">
              <p>{definition}</p>
              {formula && (
                <p className="text-muted-foreground/60 font-mono text-[11px]">{formula}</p>
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6 pt-2">
          {periods && periods.length > 0 && (
            <section aria-label="Period comparison">
              <h3 className="text-muted-foreground mb-2 text-[10px] font-medium uppercase tracking-wider">
                Across periods
              </h3>
              <div className="grid grid-cols-5 gap-1.5">
                {periods.map((p) => (
                  <div
                    key={p.label}
                    className={cn(
                      "border-border/50 space-y-0.5 rounded-lg border p-2 text-center",
                      p.current && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <div className="text-muted-foreground/70 text-[9px] uppercase tracking-wider">
                      {p.label}
                    </div>
                    <div
                      className="font-mono text-xs font-semibold tabular-nums"
                      data-private="true"
                    >
                      {p.value}
                    </div>
                    {p.subtitle && (
                      <div className="text-muted-foreground/60 text-[9px] tabular-nums">
                        {p.subtitle}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {children}

          {analyticsHref && (
            <Link
              href={analyticsHref}
              className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              View full analytics
              <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
