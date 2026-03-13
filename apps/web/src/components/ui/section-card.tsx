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
    <div className={cn("rounded-lg border border-border/50 bg-card", className)}>
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        <Icon className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-medium text-muted-foreground">{title}</span>
      </div>
      {helper && (
        <p className="text-[10px] text-muted-foreground/60 px-3 leading-tight">{helper}</p>
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
    <div className="flex items-center justify-between py-1.5 border-b border-dashed border-border/50 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-mono tabular-nums text-foreground", className)}>{value}</span>
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
    <div className={cn("rounded-lg bg-background/60 p-2.5", large && "col-span-2")}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className={cn("font-mono tabular-nums font-medium", large ? "text-base" : "text-sm", className)}>
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
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-mono tabular-nums", className)}>{value}</span>
    </div>
  )
}
