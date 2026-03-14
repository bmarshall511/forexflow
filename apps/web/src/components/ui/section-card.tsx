import { cn } from "@/lib/utils"

interface SectionCardProps {
  icon: React.ElementType
  title: string
  helper?: string
  children: React.ReactNode
  className?: string
}

export function SectionCard({ icon: Icon, title, helper, children, className }: SectionCardProps) {
  return (
    <div className={cn("border-border/50 bg-card rounded-lg border", className)}>
      <div className="flex items-center gap-2 px-3 pb-1 pt-2.5">
        <Icon className="text-muted-foreground size-3.5 shrink-0" />
        <span className="text-muted-foreground text-[11px] font-medium">{title}</span>
      </div>
      {helper && (
        <p className="text-muted-foreground/60 px-3 text-[10px] leading-tight">{helper}</p>
      )}
      <div className="px-3 pb-3 pt-1.5">{children}</div>
    </div>
  )
}

interface DetailRowProps {
  label: string
  value: React.ReactNode
  className?: string
}

export function DetailRow({ label, value, className }: DetailRowProps) {
  return (
    <div className="border-border/50 flex items-center justify-between border-b border-dashed py-1.5 last:border-b-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={cn("text-foreground font-mono text-xs tabular-nums", className)}>
        {value}
      </span>
    </div>
  )
}

interface MetricTileProps {
  label: string
  value: React.ReactNode
  className?: string
  large?: boolean
}

export function MetricTile({ label, value, className, large }: MetricTileProps) {
  return (
    <div className={cn("bg-background/60 rounded-lg p-2.5", large && "col-span-2")}>
      <p className="text-muted-foreground mb-0.5 text-[10px] uppercase tracking-wide">{label}</p>
      <p
        className={cn(
          "font-mono font-medium tabular-nums",
          large ? "text-base" : "text-sm",
          className,
        )}
      >
        {value}
      </p>
    </div>
  )
}

interface SummaryRowProps {
  label: string
  value: string
  className?: string
}

export function SummaryRow({ label, value, className }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-[10px]">{label}</span>
      <span className={cn("font-mono text-xs tabular-nums", className)}>{value}</span>
    </div>
  )
}
