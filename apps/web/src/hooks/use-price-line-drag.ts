"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import type { IChartApi, ISeriesApi, IPriceLine } from "lightweight-charts"
import { getDecimalPlaces } from "@fxflow/shared"

export type LineType = "entry" | "sl" | "tp"

interface DraggableLines {
  entry?: IPriceLine | null
  sl?: IPriceLine | null
  tp?: IPriceLine | null
}

interface UsePriceLineDragOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
  seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>
  chartRef: React.RefObject<IChartApi | null>
  lines: DraggableLines
  instrument: string
  enabled?: boolean
  onDraftChange: (lineType: LineType, price: number) => void
}

export interface UsePriceLineDragReturn {
  isDragging: boolean
  dragLineType: LineType | null
}

const MOUSE_HIT_PX = 8
const TOUCH_HIT_PX = 20

export function usePriceLineDrag({
  containerRef,
  seriesRef,
  chartRef,
  lines,
  instrument,
  enabled = true,
  onDraftChange,
}: UsePriceLineDragOptions): UsePriceLineDragReturn {
  const [isDragging, setIsDragging] = useState(false)
  const [dragLineType, setDragLineType] = useState<LineType | null>(null)
  const draggingRef = useRef<{ lineType: LineType; line: IPriceLine } | null>(null)
  const rafRef = useRef<number | null>(null)
  const decimals = getDecimalPlaces(instrument)

  const wasDraggingRef = useRef(false)

  const getLineYCoord = useCallback(
    (line: IPriceLine): number | null => {
      const series = seriesRef.current
      if (!series) return null
      const price = line.options().price
      const y = series.priceToCoordinate(price)
      return y ?? null
    },
    [seriesRef],
  )

  const findHitLine = useCallback(
    (y: number, hitPx: number): { lineType: LineType; line: IPriceLine } | null => {
      let closest: { lineType: LineType; line: IPriceLine; dist: number } | null = null

      for (const [type, line] of Object.entries(lines) as [
        LineType,
        IPriceLine | null | undefined,
      ][]) {
        if (!line) continue
        const lineY = getLineYCoord(line)
        if (lineY === null) continue
        const dist = Math.abs(y - lineY)
        if (dist <= hitPx && (closest === null || dist < closest.dist)) {
          closest = { lineType: type, line, dist }
        }
      }

      return closest
    },
    [lines, getLineYCoord],
  )

  const roundPrice = useCallback(
    (price: number): number => Number(price.toFixed(decimals)),
    [decimals],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container || !enabled) return

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const series = seriesRef.current
      const chart = chartRef.current
      if (!series || !chart) return

      const rect = container.getBoundingClientRect()
      const clientY = "touches" in e ? e.touches[0]!.clientY : e.clientY
      const y = clientY - rect.top

      const isTouch = "touches" in e
      const hit = findHitLine(y, isTouch ? TOUCH_HIT_PX : MOUSE_HIT_PX)
      if (!hit) return

      e.preventDefault()
      e.stopPropagation()

      draggingRef.current = hit
      setIsDragging(true)
      setDragLineType(hit.lineType)

      // Disable chart interaction during drag
      wasDraggingRef.current = true
      chart.applyOptions({
        handleScroll: false,
        handleScale: false,
        crosshair: { mode: 0 },
      })
      container.style.cursor = "ns-resize"
    }

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) {
        // Show cursor hint on hover
        const series = seriesRef.current
        if (!series) return
        const rect = container.getBoundingClientRect()
        const clientY = "clientY" in e ? e.clientY : 0
        const y = clientY - rect.top
        const hit = findHitLine(y, MOUSE_HIT_PX)
        container.style.cursor = hit ? "ns-resize" : ""
        return
      }

      e.preventDefault()

      const series = seriesRef.current
      if (!series) return

      const rect = container.getBoundingClientRect()
      const clientY = "touches" in e ? e.touches[0]!.clientY : e.clientY
      const y = clientY - rect.top

      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const price = series.coordinateToPrice(y)
        if (price === null || price <= 0) return

        const rounded = roundPrice(price as number)
        const { line, lineType } = draggingRef.current!
        line.applyOptions({ price: rounded })
        onDraftChange(lineType, rounded)
      })
    }

    const handlePointerUp = () => {
      if (!draggingRef.current) return

      const chart = chartRef.current
      if (chart && wasDraggingRef.current) {
        chart.applyOptions({
          handleScroll: true,
          handleScale: true,
          crosshair: { mode: 1 },
        })
      }

      draggingRef.current = null
      wasDraggingRef.current = false
      setIsDragging(false)
      setDragLineType(null)
      container.style.cursor = ""

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    // Mouse events
    container.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("mousemove", handlePointerMove)
    document.addEventListener("mouseup", handlePointerUp)

    // Touch events
    container.addEventListener("touchstart", handlePointerDown, { passive: false })
    document.addEventListener("touchmove", handlePointerMove, { passive: false })
    document.addEventListener("touchend", handlePointerUp)

    return () => {
      container.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("mousemove", handlePointerMove)
      document.removeEventListener("mouseup", handlePointerUp)
      container.removeEventListener("touchstart", handlePointerDown)
      document.removeEventListener("touchmove", handlePointerMove)
      document.removeEventListener("touchend", handlePointerUp)

      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [containerRef, seriesRef, chartRef, findHitLine, roundPrice, onDraftChange, enabled])

  return { isDragging, dragLineType }
}
