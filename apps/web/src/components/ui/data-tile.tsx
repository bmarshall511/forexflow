import { cn } from "@/lib/utils"

type DataTileVariant = "default" | "positive" | "negative" | "accent" | "muted"

interface DataTileProps {
  label: string
  value: React.ReactNode
  /** Optional subtitle text below the value */
  subtitle?: string
  /** Optional icon displayed next to the label */
  icon?: React.ReactNode
  /** Visual variant for color accents */
  variant?: DataTileVariant
  /** Render a sparkline or other visual below the value */
  sparkline?: React.ReactNode
  /** Full-width tile (spans 2 cols in a grid) */
  wide?: boolean
  className?: string
}

const variantStyles: Record<DataTileVariant, string> = {
  default: "",
  positive: "border-l-2 border-l-status-connected",
  negative: "border-l-2 border-l-status-disconnected",
  accent: "border-l-2 border-l-primary",
  muted: "opacity-70",
}

const valueColorStyles: Record<DataTileVariant, string> = {
  default: "text-foreground",
  positive: "text-status-connected",
  negative: "text-status-disconnected",
  accent: "text-primary",
  muted: "text-muted-foreground",
}

export function DataTile({
  label,
  value,
  subtitle,
  icon,
  variant = "default",
  sparkline,
  wide,
  className,
}: DataTileProps) {
  return (
    <div
      className={cn(
        "border-border/50 bg-card space-y-1 rounded-lg border p-3",
        variantStyles[variant],
        wide && "col-span-2",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
        <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className={cn("font-mono text-sm font-semibold tabular-nums", valueColorStyles[variant])}>
        {value}
      </p>
      {subtitle && <p className="text-muted-foreground truncate text-[10px]">{subtitle}</p>}
      {sparkline && <div className="pt-1">{sparkline}</div>}
    </div>
  )
}

/** Compact inline stat for use within cards — label left, value right */
export function InlineStat({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground text-[10px]">{label}</span>
      <span className={cn("text-foreground font-mono text-xs tabular-nums", className)}>
        {value}
      </span>
    </div>
  )
}

/** CSS-only donut/ring chart for percentages */
export function DonutChart({
  value,
  size = 48,
  strokeWidth = 4,
  className,
}: {
  value: number
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(Math.max(value, 0), 100) / 100)
  const color =
    value >= 60
      ? "stroke-status-connected"
      : value >= 40
        ? "stroke-status-warning"
        : "stroke-status-disconnected"

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn("transition-all duration-500", color)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute font-mono text-xs font-semibold tabular-nums">
        {Math.round(value)}%
      </span>
    </div>
  )
}

/** Horizontal proportion bar (e.g., executed/rejected/failed breakdown) */
export function ProportionBar({
  segments,
  className,
}: {
  segments: { value: number; color: string; label?: string }[]
  className?: string
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  if (total === 0) return null

  return (
    <div className={cn("space-y-1", className)}>
      <div className="bg-muted flex h-2 overflow-hidden rounded-full">
        {segments.map((seg, i) => {
          const pct = (seg.value / total) * 100
          if (pct === 0) return null
          return (
            <div
              key={i}
              className="h-full transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: seg.color }}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map((seg, i) => (
          <div key={i} className="text-muted-foreground flex items-center gap-1 text-[10px]">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            {seg.label && <span>{seg.label}</span>}
            <span className="font-mono tabular-nums">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
