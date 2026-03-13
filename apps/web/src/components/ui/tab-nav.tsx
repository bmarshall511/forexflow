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
    <div className={cn("sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b", className)}>
      <div className="px-4 md:px-6">
        <nav className="flex gap-1 -mb-px" aria-label={label}>
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
        "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className={cn(active && pulse && "text-green-500")}>{icon}</span>
      {label}
      {count > 0 && (
        <Badge
          variant="secondary"
          className={cn(
            "h-5 min-w-5 text-[10px] px-1.5 font-mono",
            active && pulse && "bg-green-500/15 text-green-500",
          )}
        >
          {count}
        </Badge>
      )}
    </button>
  )
}
