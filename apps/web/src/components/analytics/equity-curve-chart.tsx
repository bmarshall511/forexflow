"use client"

import { useMemo, useState, useCallback, useRef } from "react"
import type { EquityCurvePoint } from "@fxflow/types"
import { cn } from "@/lib/utils"

interface Props {
  data: EquityCurvePoint[]
  height?: number
  className?: string
  compact?: boolean
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

export function EquityCurveChart({ data, height = 280, className, compact = false }: Props) {
  const [tip, setTip] = useState<{ x: number; y: number; pt: EquityCurvePoint } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [pL, pR, pT, pB] = compact ? [4, 4, 4, 4] : [56, 16, 16, 28]

  const points = useMemo(() => {
    if (!data.length) return []
    const vals = data.map((d) => d.cumulativePL)
    const min = Math.min(0, ...vals),
      max = Math.max(0, ...vals),
      range = max - min || 1
    return data.map((d, i) => ({
      x: pL + (i / Math.max(data.length - 1, 1)) * (100 - pL - pR),
      y: pT + (1 - (d.cumulativePL - min) / range) * (100 - pT - pB),
      zY: pT + (1 - (0 - min) / range) * (100 - pT - pB),
      pt: d,
    }))
  }, [data, pL, pR, pT, pB])

  const segments = useMemo(() => {
    if (points.length < 2) return []
    return points.slice(1).map((c, i) => {
      const p = points[i]!
      return {
        d: `M${p.x},${p.y} L${c.x},${c.y}`,
        c: c.pt.cumulativePL >= p.pt.cumulativePL ? "#22c55e" : "#ef4444",
      }
    })
  }, [points])

  const areaPath = useMemo(() => {
    if (!points.length) return ""
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
    return `${line} L${points.at(-1)!.x},${points[0]!.zY} L${points[0]!.x},${points[0]!.zY} Z`
  }, [points])

  const lastPL = data.at(-1)?.cumulativePL ?? 0
  const pos = lastPL >= 0
  const gId = pos ? "eq-g" : "eq-r"
  const gColor = pos ? "#22c55e" : "#ef4444"

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!points.length || !svgRef.current) return
      const pctX =
        ((e.clientX - svgRef.current.getBoundingClientRect().left) /
          svgRef.current.getBoundingClientRect().width) *
        100
      let best = points[0]!,
        bestD = Math.abs(pctX - best.x)
      for (const p of points) {
        const d = Math.abs(pctX - p.x)
        if (d < bestD) {
          bestD = d
          best = p
        }
      }
      setTip({ x: best.x, y: best.y, pt: best.pt })
    },
    [points],
  )

  if (!data.length) {
    return (
      <div
        className={cn("text-muted-foreground flex items-center justify-center text-sm", className)}
        style={{ height }}
      >
        No equity data available
      </div>
    )
  }

  const vals = data.map((d) => d.cumulativePL)
  const minV = Math.min(0, ...vals),
    maxV = Math.max(0, ...vals)

  return (
    <div className={cn("relative", className)}>
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={() => setTip(null)}
        role="img"
        aria-label={`Balance chart: ${pos ? "profit" : "loss"} of ${lastPL.toFixed(2)}`}
      >
        <defs>
          <linearGradient id={gId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={gColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={gColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gId})`} />
        {segments.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill="none"
            stroke={s.c}
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {!compact && points.length > 0 && (
          <line
            x1={pL}
            x2={100 - pR}
            y1={points[0]!.zY}
            y2={points[0]!.zY}
            stroke="currentColor"
            strokeWidth="0.15"
            className="text-border"
            strokeDasharray="1,1"
          />
        )}
        {tip && <circle cx={tip.x} cy={tip.y} r="0.8" fill="#6366f1" />}
      </svg>
      {!compact && (
        <>
          <span className="text-muted-foreground absolute left-1 top-2 text-[10px] tabular-nums">
            {maxV.toFixed(0)}
          </span>
          <span className="text-muted-foreground absolute bottom-6 left-1 text-[10px] tabular-nums">
            {minV.toFixed(0)}
          </span>
        </>
      )}
      {!compact && data.length > 1 && (
        <div className="text-muted-foreground mt-1 flex justify-between px-14 text-[10px]">
          <span>{fmtDate(data[0]!.date)}</span>
          <span>{fmtDate(data.at(-1)!.date)}</span>
        </div>
      )}
      {tip && !compact && (
        <div
          className="bg-popover text-popover-foreground pointer-events-none absolute rounded-lg border px-3 py-2 text-xs shadow-lg"
          style={{ left: `${tip.x}%`, top: 0, transform: "translateX(-50%)" }}
        >
          <p className="font-medium">{fmtDate(tip.pt.date)}</p>
          <p
            className={cn(
              "text-sm font-bold tabular-nums",
              pos ? "text-green-500" : "text-red-500",
            )}
          >
            {tip.pt.cumulativePL >= 0 ? "+" : ""}
            {tip.pt.cumulativePL.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  )
}
