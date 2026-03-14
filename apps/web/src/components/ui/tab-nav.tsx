import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface TabNavProps {
  children: React.ReactNode
  label?: string
  className?: string
}

/** Sticky tab navigation bar — matches positions & trade finder pages */
export function TabNav({ children, label = "Sections", className }: TabNavProps) {
  return (
    <div className={cn("bg-background/95 sticky top-0 z-10 border-b backdrop-blur-sm", className)}>
      <div className="px-4 md:px-6">
        <nav className="-mb-px flex gap-1" aria-label={label}>
          {children}
        </nav>
      </div>
    </div>
  )
}

interface TabNavButtonProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count: number
  pulse?: boolean
}

/** Single tab button inside a TabNav */
export function TabNavButton({ active, onClick, icon, label, count, pulse }: TabNavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
        active
          ? "border-foreground text-foreground"
          : "text-muted-foreground hover:text-foreground hover:border-border border-transparent",
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className={cn(active && pulse && "text-green-500")}>{icon}</span>
      {label}
      {count > 0 && (
        <Badge
          variant="secondary"
          className={cn(
            "h-5 min-w-5 px-1.5 font-mono text-[10px]",
            active && pulse && "bg-green-500/15 text-green-500",
          )}
        >
          {count}
        </Badge>
      )}
    </button>
  )
}
