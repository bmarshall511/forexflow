import { cn } from "@/lib/utils"

interface PriceCardProps {
  icon: React.ReactNode
  label: string
  value: string
  color: string
  sublabel?: string
}

/** Compact price display card used in trade cards and setup cards */
export function PriceCard({ icon, label, value, color, sublabel }: PriceCardProps) {
  const isUnset = value === "None" || value === "—"
  return (
    <div className={cn(
      "rounded-lg border p-2.5 text-center",
      isUnset ? "border-dashed border-border/40 bg-muted/20" : "bg-muted/30",
    )}>
      <div className={cn("flex items-center justify-center gap-1 mb-1", color)}>
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn(
        "text-sm font-mono tabular-nums font-bold",
        isUnset ? "text-muted-foreground/50" : color,
      )}>
        {value}
      </div>
      {sublabel && (
        <div className="text-[9px] text-muted-foreground/70 mt-0.5">{sublabel}</div>
      )}
    </div>
  )
}

/** Inline key-value row for stat grids */
export function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-border/30 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-foreground">{value}</span>
    </div>
  )
}
