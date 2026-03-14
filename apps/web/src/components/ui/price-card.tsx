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
    <div
      className={cn(
        "rounded-lg border p-2.5 text-center",
        isUnset ? "border-border/40 bg-muted/20 border-dashed" : "bg-muted/30",
      )}
    >
      <div className={cn("mb-1 flex items-center justify-center gap-1", color)}>
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div
        className={cn(
          "font-mono text-sm font-bold tabular-nums",
          isUnset ? "text-muted-foreground/50" : color,
        )}
      >
        {value}
      </div>
      {sublabel && <div className="text-muted-foreground/70 mt-0.5 text-[9px]">{sublabel}</div>}
    </div>
  )
}

/** Inline key-value row for stat grids */
export function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-border/30 flex items-center justify-between border-b py-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-mono tabular-nums">{value}</span>
    </div>
  )
}
