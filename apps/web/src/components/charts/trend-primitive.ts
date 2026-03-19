import type {
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  SeriesAttachedParameter,
  Time,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  ISeriesApi,
  SeriesType,
  ITimeScaleApi,
} from "lightweight-charts"
import type { TrendData, TrendVisualSettings, SwingPoint } from "@fxflow/types"
import { getChartTheme, type ChartTheme } from "@/lib/chart-theme"

// ─── Price Axis View ─────────────────────────────────────────────────────────

class TrendAxisView implements ISeriesPrimitiveAxisView {
  private _series: ISeriesApi<SeriesType, Time>
  private _price: number
  private _text: string
  private _textColor: string
  private _backColor: string

  constructor(
    series: ISeriesApi<SeriesType, Time>,
    price: number,
    text: string,
    textColor: string,
    backColor: string,
  ) {
    this._series = series
    this._price = price
    this._text = text
    this._textColor = textColor
    this._backColor = backColor
  }

  coordinate(): number {
    return (this._series.priceToCoordinate(this._price) as number | null) ?? -1000
  }

  text(): string {
    return this._text
  }
  textColor(): string {
    return this._textColor
  }
  backColor(): string {
    return this._backColor
  }
}

// ─── Pane View & Renderer ────────────────────────────────────────────────────

class TrendPaneView implements IPrimitivePaneView {
  private _source: TrendPrimitive

  constructor(source: TrendPrimitive) {
    this._source = source
  }

  zOrder(): "bottom" {
    return "bottom"
  }

  renderer(): IPrimitivePaneRenderer | null {
    return new TrendPaneRenderer(this._source)
  }
}

class TrendPaneRenderer implements IPrimitivePaneRenderer {
  private _source: TrendPrimitive

  constructor(source: TrendPrimitive) {
    this._source = source
  }

  draw(target: {
    useMediaCoordinateSpace: <T>(fn: (scope: { context: CanvasRenderingContext2D }) => T) => T
  }): void {
    const { trendData, visuals, series, timeScale, isDark, htfTrendData } = this._source
    if (!series || !timeScale) return

    const theme = getChartTheme(isDark)

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const dpr = window.devicePixelRatio || 1

      // Draw HTF trend first (behind primary)
      if (htfTrendData && htfTrendData.swingPoints.length >= 2) {
        this._drawTrend(ctx, htfTrendData, visuals, series, timeScale, isDark, dpr, 0.4, theme)
      }

      // Draw primary trend
      if (trendData && trendData.swingPoints.length >= 2) {
        this._drawTrend(ctx, trendData, visuals, series, timeScale, isDark, dpr, 1.0, theme)
      }
    })
  }

  private _drawTrend(
    ctx: CanvasRenderingContext2D,
    data: TrendData,
    visuals: TrendVisualSettings,
    series: ISeriesApi<SeriesType, Time>,
    timeScale: ITimeScaleApi<Time>,
    isDark: boolean,
    dpr: number,
    opacityScale: number,
    theme: ChartTheme,
  ): void {
    const trendColor =
      data.direction === "up"
        ? theme.upTrend
        : data.direction === "down"
          ? theme.downTrend
          : theme.rangeTrend

    ctx.save()

    // ─── Trend Boxes ─────────────────────────────────────────────
    if (visuals.showBoxes && data.segments.length > 0) {
      this._drawBoxes(ctx, data, visuals, series, timeScale, isDark, opacityScale, theme)
    }

    // ─── Trend Lines ─────────────────────────────────────────────
    if (visuals.showLines && data.swingPoints.length >= 2) {
      this._drawLines(ctx, data, series, timeScale, trendColor, opacityScale)
    }

    // ─── Swing Markers ───────────────────────────────────────────
    if (visuals.showMarkers && data.swingPoints.length > 0) {
      this._drawMarkers(ctx, data, series, timeScale, trendColor, opacityScale, isDark)
    }

    // ─── Swing Labels ────────────────────────────────────────────
    if (visuals.showLabels && data.swingPoints.length > 0) {
      this._drawLabels(ctx, data, series, timeScale, isDark, opacityScale, theme)
    }

    // ─── Controlling Swing Line ──────────────────────────────────
    if (visuals.showControllingSwing && data.controllingSwing) {
      this._drawControllingSwing(
        ctx,
        data.controllingSwing,
        trendColor,
        series,
        isDark,
        opacityScale,
      )
    }

    // ─── Trend Summary Badge ──────────────────────────────────
    // When MTF swing points are outside the LTF chart's loaded time range,
    // show a compact summary badge so the user still sees trend context.
    if (opacityScale >= 1.0) {
      const hasVisiblePoints = data.swingPoints.some(
        (sw) => timeScale.timeToCoordinate(sw.time as unknown as Time) != null,
      )
      if (!hasVisiblePoints) {
        this._drawTrendBadge(ctx, data, trendColor, isDark)
      }
    }

    ctx.restore()
  }

  private _drawBoxes(
    ctx: CanvasRenderingContext2D,
    data: TrendData,
    visuals: TrendVisualSettings,
    series: ISeriesApi<SeriesType, Time>,
    timeScale: ITimeScaleApi<Time>,
    isDark: boolean,
    opacityScale: number,
    theme: ChartTheme,
  ): void {
    const opacity = visuals.boxOpacity * opacityScale

    const chartWidth = ctx.canvas.width / (window.devicePixelRatio || 1)

    for (const seg of data.segments) {
      // Clamp segment edges to chart boundaries when times are outside loaded range
      const rawFromX = timeScale.timeToCoordinate(seg.from.time as unknown as Time) as number | null
      const rawToX = timeScale.timeToCoordinate(seg.to.time as unknown as Time) as number | null
      const topPrice = Math.max(seg.from.price, seg.to.price)
      const bottomPrice = Math.min(seg.from.price, seg.to.price)
      const topY = series.priceToCoordinate(topPrice) as number | null
      const bottomY = series.priceToCoordinate(bottomPrice) as number | null

      if (topY == null || bottomY == null) continue
      const fromX = rawFromX ?? 0
      const toX = rawToX ?? chartWidth

      // Color based on segment direction and trend
      const isWithTrend =
        (data.direction === "up" && seg.direction === "up") ||
        (data.direction === "down" && seg.direction === "down")
      const color = isWithTrend ? theme.trendImpulse : theme.trendCorrection

      ctx.fillStyle = hexToRgba(color, opacity)
      const x = Math.min(fromX, toX)
      const w = Math.abs(toX - fromX)
      const h = Math.abs(bottomY - topY)
      ctx.fillRect(x, topY, w, h)

      // Subtle border
      ctx.strokeStyle = hexToRgba(color, opacity * 3)
      ctx.lineWidth = 0.5
      ctx.strokeRect(x, topY, w, h)
    }
  }

  private _drawLines(
    ctx: CanvasRenderingContext2D,
    data: TrendData,
    series: ISeriesApi<SeriesType, Time>,
    timeScale: ITimeScaleApi<Time>,
    trendColor: string,
    opacityScale: number,
  ): void {
    ctx.strokeStyle = hexToRgba(trendColor, 0.8 * opacityScale)
    ctx.lineWidth = 2
    ctx.setLineDash([])

    ctx.beginPath()
    let started = false

    for (const sw of data.swingPoints) {
      // Clamp x to chart edges when the swing point time is outside the loaded candle range.
      // This happens when MTF (e.g., Daily) swing points are plotted on an LTF (e.g., H1) chart
      // that only loads ~8 days of data while the trend spans months.
      const rawX = timeScale.timeToCoordinate(sw.time as unknown as Time)
      const y = series.priceToCoordinate(sw.price) as number | null
      if (y == null) continue

      // If time is outside the loaded range, clamp to left edge
      const x: number = rawX ?? 0

      if (!started) {
        ctx.moveTo(x, y)
        started = true
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.stroke()
  }

  private _drawMarkers(
    ctx: CanvasRenderingContext2D,
    data: TrendData,
    series: ISeriesApi<SeriesType, Time>,
    timeScale: ITimeScaleApi<Time>,
    trendColor: string,
    opacityScale: number,
    isDark: boolean,
  ): void {
    const radius = 4

    for (const sw of data.swingPoints) {
      const x = timeScale.timeToCoordinate(sw.time as unknown as Time)
      const y = series.priceToCoordinate(sw.price) as number | null

      // Only draw markers for swing points with valid time coordinates on the chart
      // (don't clamp to edge like lines — stacking markers at x=0 would be cluttered)
      if (x == null || y == null) continue

      // Filled circle
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = hexToRgba(trendColor, 0.9 * opacityScale)
      ctx.fill()

      // Border ring (adapts to theme)
      ctx.strokeStyle = hexToRgba(isDark ? "#ffffff" : "#000000", 0.6 * opacityScale)
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }

  private _drawLabels(
    ctx: CanvasRenderingContext2D,
    data: TrendData,
    series: ISeriesApi<SeriesType, Time>,
    timeScale: ITimeScaleApi<Time>,
    isDark: boolean,
    opacityScale: number,
    theme: ChartTheme,
  ): void {
    ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    for (const sw of data.swingPoints) {
      const x = timeScale.timeToCoordinate(sw.time as unknown as Time)
      const y = series.priceToCoordinate(sw.price) as number | null

      if (x == null || y == null) continue

      const label = sw.label
      const isHigh = sw.type === "high"
      const offsetY = isHigh ? -14 : 14

      // Determine label color based on context
      const isPositive = label === "HH" || label === "HL"
      const isNegative = label === "LL" || label === "LH"
      const pillColor = isPositive ? theme.upTrend : isNegative ? theme.downTrend : theme.rangeTrend

      const metrics = ctx.measureText(label)
      const padX = 4
      const padY = 2
      const w = metrics.width + padX * 2
      const h = 12 + padY
      const lx = x - w / 2
      const ly = y + offsetY - h / 2

      // Background pill
      ctx.fillStyle = hexToRgba(isDark ? "#000000" : "#ffffff", 0.7 * opacityScale)
      ctx.beginPath()
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(lx, ly, w, h, 3)
      } else {
        ctx.rect(lx, ly, w, h)
      }
      ctx.fill()

      // Border
      ctx.strokeStyle = hexToRgba(pillColor, 0.5 * opacityScale)
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Text
      ctx.fillStyle = hexToRgba(pillColor, 0.9 * opacityScale)
      ctx.fillText(label, x, y + offsetY)
    }
  }

  /**
   * Draw a compact trend summary badge in the top-left of the chart area.
   * Shown when MTF swing points are entirely outside the LTF chart's loaded data range
   * (e.g., Daily trend on an H1 chart that only loads 8 days of data).
   */
  private _drawTrendBadge(
    ctx: CanvasRenderingContext2D,
    data: TrendData,
    trendColor: string,
    isDark: boolean,
  ): void {
    const dir = data.direction === "up" ? "▲ Up" : data.direction === "down" ? "▼ Down" : "◆ Range"
    const status =
      data.status === "confirmed"
        ? "Confirmed"
        : data.status === "forming"
          ? "Forming"
          : "Terminated"
    const label = `MTF Trend: ${dir} · ${status}`

    ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, sans-serif"
    const metrics = ctx.measureText(label)
    const pad = 5
    const w = metrics.width + pad * 2
    const h = 16
    const x = 8
    const y = 8

    // Background
    ctx.fillStyle = isDark ? "rgba(0, 0, 0, 0.75)" : "rgba(255, 255, 255, 0.85)"
    ctx.beginPath()
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, 3)
    } else {
      ctx.rect(x, y, w, h)
    }
    ctx.fill()

    // Border
    ctx.strokeStyle = hexToRgba(trendColor, 0.5)
    ctx.lineWidth = 0.5
    ctx.stroke()

    // Text
    ctx.fillStyle = trendColor
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillText(label, x + pad, y + h / 2)
  }

  private _drawControllingSwing(
    ctx: CanvasRenderingContext2D,
    swing: SwingPoint,
    trendColor: string,
    series: ISeriesApi<SeriesType, Time>,
    isDark: boolean,
    opacityScale: number,
  ): void {
    const y = series.priceToCoordinate(swing.price) as number | null
    if (y == null) return

    const chartWidth = ctx.canvas.width / (window.devicePixelRatio || 1)

    // Dashed horizontal line
    ctx.strokeStyle = hexToRgba(trendColor, 0.5 * opacityScale)
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(chartWidth, y)
    ctx.stroke()
    ctx.setLineDash([])

    // "CTRL" label on the right
    ctx.font = "bold 8px -apple-system, BlinkMacSystemFont, sans-serif"
    ctx.textAlign = "right"
    ctx.textBaseline = "middle"
    const label = "CTRL"
    const metrics = ctx.measureText(label)
    const pad = 3
    const w = metrics.width + pad * 2
    const h = 12
    const lx = chartWidth - 8 - w
    const ly = y - h / 2

    ctx.fillStyle = hexToRgba(isDark ? "#000000" : "#ffffff", 0.8 * opacityScale)
    ctx.beginPath()
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(lx, ly, w, h, 2)
    } else {
      ctx.rect(lx, ly, w, h)
    }
    ctx.fill()

    ctx.strokeStyle = hexToRgba(trendColor, 0.4 * opacityScale)
    ctx.lineWidth = 0.5
    ctx.stroke()

    ctx.fillStyle = hexToRgba(trendColor, 0.9 * opacityScale)
    ctx.fillText(label, chartWidth - 8 - pad, y)
  }
}

// ─── Primitive Class ─────────────────────────────────────────────────────────

export class TrendPrimitive implements ISeriesPrimitive<Time> {
  private _trendData: TrendData | null = null
  private _htfTrendData: TrendData | null = null
  private _visuals: TrendVisualSettings = {
    showBoxes: false,
    showLines: true,
    showMarkers: true,
    showLabels: true,
    showControllingSwing: true,
    boxOpacity: 0.06,
  }
  private _isDark = true
  private _series: ISeriesApi<SeriesType, Time> | null = null
  private _timeScale: ITimeScaleApi<Time> | null = null
  private _requestUpdate?: () => void
  private _paneView: TrendPaneView
  private _priceAxisViews: ISeriesPrimitiveAxisView[] = []

  constructor() {
    this._paneView = new TrendPaneView(this)
  }

  // Public getters for the renderer
  get trendData(): TrendData | null {
    return this._trendData
  }
  get htfTrendData(): TrendData | null {
    return this._htfTrendData
  }
  get visuals(): TrendVisualSettings {
    return this._visuals
  }
  get isDark(): boolean {
    return this._isDark
  }
  get series(): ISeriesApi<SeriesType, Time> | null {
    return this._series
  }
  get timeScale(): ITimeScaleApi<Time> | null {
    return this._timeScale
  }

  attached(params: SeriesAttachedParameter<Time>): void {
    this._series = params.series
    this._timeScale = params.chart.timeScale()
    this._requestUpdate = params.requestUpdate
  }

  detached(): void {
    this._series = null
    this._timeScale = null
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

  /** Set or update primary trend data. */
  setTrend(data: TrendData | null, visuals: TrendVisualSettings, isDark: boolean): void {
    this._trendData = data
    this._visuals = visuals
    this._isDark = isDark
    this._rebuildAxisViews()
    this._requestUpdate?.()
  }

  /** Set higher-timeframe trend data. */
  setHigherTfTrend(data: TrendData | null): void {
    this._htfTrendData = data
    this._requestUpdate?.()
  }

  /** Clear all trend data. */
  clearTrend(): void {
    this._trendData = null
    this._htfTrendData = null
    this._priceAxisViews = []
    this._requestUpdate?.()
  }

  private _rebuildAxisViews(): void {
    const views: ISeriesPrimitiveAxisView[] = []
    const series = this._series
    const data = this._trendData

    if (!series || !data || !data.controllingSwing || !this._visuals.showControllingSwing) {
      this._priceAxisViews = []
      return
    }

    const isDark = this._isDark
    const theme = getChartTheme(isDark)
    const trendColor =
      data.direction === "up"
        ? theme.upTrend
        : data.direction === "down"
          ? theme.downTrend
          : theme.rangeTrend

    views.push(
      new TrendAxisView(
        series,
        data.controllingSwing.price,
        "CTRL",
        trendColor,
        isDark ? "rgba(20, 20, 30, 0.9)" : "rgba(240, 240, 250, 0.9)",
      ),
    )

    this._priceAxisViews = views
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex.replace(/[\d.]+\)$/, `${alpha})`)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
