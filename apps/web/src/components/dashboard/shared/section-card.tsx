import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Shared dashboard section shell — matches the Performance Hero + Depth
 * Sections idiom. Header holds an icon + uppercase-wide label; an optional
 * `action` slot (typically a "View all →" link) sits flush right, and a
 * `meta` slot can render a small muted descriptor between the two.
 *
 * Keep the chrome identical across cards so the eye doesn't re-learn a new
 * layout per section.
 */
interface SectionCardProps {
  icon: ReactNode
  title: string
  meta?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  /** `aria-label` override; defaults to `title`. */
  ariaLabel?: string
}

export function SectionCard({
  icon,
  title,
  meta,
  action,
  children,
  className,
  ariaLabel,
}: SectionCardProps) {
  return (
    <section
      aria-label={ariaLabel ?? title}
      className={cn("bg-card border-border/50 space-y-3 rounded-xl border p-4", className)}
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
        <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          {title}
        </h2>
        {meta && <span className="text-muted-foreground/70 truncate text-[11px]">{meta}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </section>
  )
}
