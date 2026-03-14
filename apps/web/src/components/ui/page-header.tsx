import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  /** Page title (h1) */
  title: React.ReactNode
  /** Subtitle/description text below the title */
  subtitle?: string
  /** Lucide icon displayed in a tinted badge next to the title */
  icon?: LucideIcon
  /** Action buttons or controls aligned to the right */
  actions?: React.ReactNode
  /** Content rendered below the title row (e.g. filter bars, status tiles) */
  children?: React.ReactNode
  /** Show bottom border — use for pages with TabNav or distinct sections below */
  bordered?: boolean
  /** Additional className on the outer container (e.g. dynamic background tints) */
  className?: string
}

/**
 * Consistent page-level header used across all feature pages.
 *
 * Renders a hero section with title, optional subtitle, optional right-aligned
 * actions, and an optional children slot for filter bars or status tiles.
 *
 * @example
 * // Simple header
 * <PageHeader title="Dashboard" subtitle="Forex trading command center" />
 *
 * @example
 * // Header with actions and bordered bottom
 * <PageHeader
 *   title="Trade Finder"
 *   subtitle="Scans the market for high-probability setups"
 *   actions={<Button size="sm">Scan Now</Button>}
 *   bordered
 * >
 *   <StatusTilesGrid />
 * </PageHeader>
 */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  bordered,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("px-4 pt-6 md:px-6", bordered ? "border-b pb-8" : "pb-4", className)}>
      <div className={cn("flex items-start justify-between gap-4", children && "mb-6")}>
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Icon className="text-primary size-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
