import type {
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  SeriesAttachedParameter,
  Time,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  ISeriesApi,
  SeriesType,
} from "lightweight-charts"
import type { CurveData } from "@fxflow/types"

// ─── Colors ──────────────────────────────────────────────────────────────────

const HIGH_COLOR = "#ef4444"   // red — near supply
const MID_COLOR = "#94a3b8"    // slate — equilibrium
const LOW_COLOR = "#22c55e"    // green — near demand
const LINE_COLOR_DARK = "rgba(148, 163, 184, 0.35)"
const LINE_COLOR_LIGHT = "rgba(100, 116, 139, 0.35)"

// ─── Price Axis View ─────────────────────────────────────────────────────────

class CurveAxisView implements ISeriesPrimitiveAxisView {
  private _series: ISeriesApi<SeriesType, Time>
  private _price: number
  private _text: string
  private _textColor: string
  private _backColor: string

  constructor(series: ISeriesApi<SeriesType, Time>, price: number, text: string, textColor: string, backColor: string) {
    this._series = series
    this._price = price
    this._text = text
    this._textColor = textColor
    this._backColor = backColor
  }

  coordinate(): number {
    return (this._series.priceToCoordinate(this._price) as number | null) ?? -1000
  }

  text(): string { return this._text }
  textColor(): string { return this._textColor }
  backColor(): string { return this._backColor }
}

// ─── Pane View & Renderer ────────────────────────────────────────────────────

class CurvePaneView implements IPrimitivePaneView {
  private _source: CurvePrimitive

  constructor(source: CurvePrimitive) {
    this._source = source
  }

  zOrder(): "bottom" {
    return "bottom"
  }

  renderer(): IPrimitivePaneRenderer | null {
    return new CurvePaneRenderer(this._source)
  }
}

class CurvePaneRenderer implements IPrimitivePaneRenderer {
  private _source: CurvePrimitive

  constructor(source: CurvePrimitive) {
    this._source = source
  }

  draw(target: { useMediaCoordinateSpace: <T>(fn: (scope: { context: CanvasRenderingContext2D }) => T) => T }): void {
    const { curveData, series, isDark } = this._source
    if (!curveData || !series) return

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const chartWidth = ctx.canvas.width / (window.devicePixelRatio || 1)

      const topY = series.priceToCoordinate(curveData.supplyDistal) as number | null
      const bottomY = series.priceToCoordinate(curveData.demandDistal) as number | null
      const highY = series.priceToCoordinate(curveData.highThreshold) as number | null
      const lowY = series.priceToCoordinate(curveData.lowThreshold) as number | null

      if (topY == null || bottomY == null || highY == null || lowY == null) return

      const opacity = curveData.opacity

      ctx.save()

      // ─── High band (top → highThreshold) ─────────────────────────
      ctx.fillStyle = hexToRgba(HIGH_COLOR, opacity)
      ctx.fillRect(0, topY, chartWidth, highY - topY)

      // ─── Middle band (highThreshold → lowThreshold) ──────────────
      ctx.fillStyle = hexToRgba(MID_COLOR, opacity * 0.6)
      ctx.fillRect(0, highY, chartWidth, lowY - highY)

      // ─── Low band (lowThreshold → bottom) ────────────────────────
      ctx.fillStyle = hexToRgba(LOW_COLOR, opacity)
      ctx.fillRect(0, lowY, chartWidth, bottomY - lowY)

      // ─── Threshold lines (dashed) ────────────────────────────────
      const lineColor = isDark ? LINE_COLOR_DARK : LINE_COLOR_LIGHT
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])

      // High threshold line
      ctx.beginPath()
      ctx.moveTo(0, highY)
      ctx.lineTo(chartWidth, highY)
      ctx.stroke()

      // Low threshold line
      ctx.beginPath()
      ctx.moveTo(0, lowY)
      ctx.lineTo(chartWidth, lowY)
      ctx.stroke()

      ctx.setLineDash([])

      // ─── Outer boundary lines (solid, subtle) ────────────────────
      ctx.strokeStyle = hexToRgba(HIGH_COLOR, 0.3)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, topY)
      ctx.lineTo(chartWidth, topY)
      ctx.stroke()

      ctx.strokeStyle = hexToRgba(LOW_COLOR, 0.3)
      ctx.beginPath()
      ctx.moveTo(0, bottomY)
      ctx.lineTo(chartWidth, bottomY)
      ctx.stroke()

      // ─── Band labels (right-aligned) ─────────────────────────────
      ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, sans-serif"
      ctx.textAlign = "right"
      ctx.textBaseline = "middle"

      const labelX = chartWidth - 8
      const pillPad = 3

      // HIGH label
      const highMidY = (topY + highY) / 2
      this._drawLabel(ctx, "HIGH", labelX, highMidY, HIGH_COLOR, isDark, pillPad)

      // MID label
      const midMidY = (highY + lowY) / 2
      this._drawLabel(ctx, "MID", labelX, midMidY, MID_COLOR, isDark, pillPad)

      // LOW label
      const lowMidY = (lowY + bottomY) / 2
      this._drawLabel(ctx, "LOW", labelX, lowMidY, LOW_COLOR, isDark, pillPad)

      ctx.restore()
    })
  }

  private _drawLabel(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string,
    isDark: boolean,
    pad: number,
  ): void {
    const metrics = ctx.measureText(text)
    const w = metrics.width + pad * 2
    const h = 14
    const lx = x - w
    const ly = y - h / 2

    // Background pill
    ctx.fillStyle = isDark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.8)"
    ctx.beginPath()
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(lx, ly, w, h, 2)
    } else {
      ctx.rect(lx, ly, w, h)
    }
    ctx.fill()

    // Border
    ctx.strokeStyle = hexToRgba(color, 0.4)
    ctx.lineWidth = 0.5
    ctx.stroke()

    // Text
    ctx.fillStyle = hexToRgba(color, 0.9)
    ctx.textAlign = "right"
    ctx.textBaseline = "middle"
    ctx.fillText(text, x - pad, y)
  }
}

// ─── Primitive Class ─────────────────────────────────────────────────────────

export class CurvePrimitive implements ISeriesPrimitive<Time> {
  private _curveData: CurveData | null = null
  private _isDark = true
  private _series: ISeriesApi<SeriesType, Time> | null = null
  private _requestUpdate?: () => void
  private _paneView: CurvePaneView
  private _priceAxisViews: ISeriesPrimitiveAxisView[] = []

  constructor() {
    this._paneView = new CurvePaneView(this)
  }

  // Public getters for the renderer
  get curveData(): CurveData | null { return this._curveData }
  get isDark(): boolean { return this._isDark }
  get series(): ISeriesApi<SeriesType, Time> | null { return this._series }

  attached(params: SeriesAttachedParameter<Time>): void {
    this._series = params.series
    this._requestUpdate = params.requestUpdate
  }

  detached(): void {
    this._series = null
    this._requestUpdate = undefined
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView]
  }

  updateAllViews(): void {
    // Pane view references this primitive directly
  }

  priceAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    return this._priceAxisViews
  }

  /** Set or update curve data. */
  setCurve(data: CurveData | null, isDark: boolean): void {
    this._curveData = data
    this._isDark = isDark
    this._rebuildAxisViews()
    this._requestUpdate?.()
  }

  /** Clear the curve. */
  clearCurve(): void {
    this._curveData = null
    this._priceAxisViews = []
    this._requestUpdate?.()
  }

  private _rebuildAxisViews(): void {
    const views: ISeriesPrimitiveAxisView[] = []
    const series = this._series
    const data = this._curveData

    if (!series || !data || !data.showAxisLabel) {
      this._priceAxisViews = []
      return
    }

    const isDark = this._isDark

    // High threshold label
    views.push(new CurveAxisView(
      series,
      data.highThreshold,
      "HIGH",
      HIGH_COLOR,
      isDark ? "rgba(30, 10, 10, 0.9)" : "rgba(254, 226, 226, 0.9)",
    ))

    // Low threshold label
    views.push(new CurveAxisView(
      series,
      data.lowThreshold,
      "LOW",
      LOW_COLOR,
      isDark ? "rgba(10, 30, 10, 0.9)" : "rgba(220, 252, 231, 0.9)",
    ))

    this._priceAxisViews = views
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  // Handle rgba() strings (pass through)
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex.replace(/[\d.]+\)$/, `${alpha})`)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
