import type {
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  SeriesAttachedParameter,
  Time,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  IChartApiBase,
  ISeriesApi,
  SeriesType,
  Coordinate,
} from "lightweight-charts"
import type { ZoneData } from "@fxflow/types"

// ─── Colors & Constants ─────────────────────────────────────────────────────

const DEMAND_COLOR = "#22c55e"
const SUPPLY_COLOR = "#ef4444"
const HTF_DEMAND_COLOR = "#16a34a"
const HTF_SUPPLY_COLOR = "#dc2626"
const INVALIDATED_COLOR = "#6b7280"

function getZoneOpacity(score: number): number {
  if (score >= 4.5) return 0.15
  if (score >= 3.0) return 0.1
  if (score >= 1.5) return 0.07
  return 0.05
}

function getZoneColor(zone: ZoneData, isHigherTf: boolean): string {
  if (zone.status === "invalidated") return INVALIDATED_COLOR
  if (zone.type === "demand") return isHigherTf ? HTF_DEMAND_COLOR : DEMAND_COLOR
  return isHigherTf ? HTF_SUPPLY_COLOR : SUPPLY_COLOR
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Darken a hex color for dark-mode axis label backgrounds */
function darken(hex: string): string {
  const r = Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * 0.3))
  const g = Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * 0.3))
  const b = Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * 0.3))
  return `rgb(${r}, ${g}, ${b})`
}

/** Lighten a hex color for light-mode axis label backgrounds */
function lighten(hex: string): string {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * 0.3 + 255 * 0.7))
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * 0.3 + 255 * 0.7))
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * 0.3 + 255 * 0.7))
  return `rgb(${r}, ${g}, ${b})`
}

// ─── Price Axis View ────────────────────────────────────────────────────────

class ZoneAxisView implements ISeriesPrimitiveAxisView {
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

// ─── Pane View & Renderer ───────────────────────────────────────────────────

class ZonePaneView implements IPrimitivePaneView {
  private _source: ZonePrimitive

  constructor(source: ZonePrimitive) {
    this._source = source
  }

  zOrder(): "bottom" {
    return "bottom"
  }

  renderer(): IPrimitivePaneRenderer | null {
    return new ZonePaneRenderer(this._source)
  }
}

class ZonePaneRenderer implements IPrimitivePaneRenderer {
  private _source: ZonePrimitive

  constructor(source: ZonePrimitive) {
    this._source = source
  }

  draw(target: {
    useMediaCoordinateSpace: <T>(fn: (scope: { context: CanvasRenderingContext2D }) => T) => T
  }): void {
    const { chart, series, zones, higherTfZones, isDark, nearestDemandId, nearestSupplyId } =
      this._source
    if (!chart || !series) return

    target.useMediaCoordinateSpace(({ context }) => {
      const timeScale = chart.timeScale()
      const visibleRange = timeScale.getVisibleLogicalRange()
      if (!visibleRange) return

      const chartWidth = context.canvas.width / (window.devicePixelRatio || 1)

      // Draw higher-TF zones first (behind primary)
      for (const zone of higherTfZones) {
        this._drawZone(context, zone, timeScale, series, chartWidth, true, false, isDark)
      }

      // Draw primary zones
      for (const zone of zones) {
        const isNearest = zone.id === nearestDemandId || zone.id === nearestSupplyId
        this._drawZone(context, zone, timeScale, series, chartWidth, false, isNearest, isDark)
      }
    })
  }

  private _drawZone(
    ctx: CanvasRenderingContext2D,
    zone: ZoneData,
    timeScale: ReturnType<IChartApiBase<Time>["timeScale"]>,
    series: ISeriesApi<SeriesType, Time>,
    chartWidth: number,
    isHigherTf: boolean,
    isNearest: boolean,
    isDark: boolean,
  ): void {
    const proximalY = series.priceToCoordinate(zone.proximalLine) as Coordinate | null
    const distalY = series.priceToCoordinate(zone.distalLine) as Coordinate | null
    if (proximalY == null || distalY == null) return

    // Zone starts at base start time and extends to the right edge of the chart
    const startX = timeScale.timeToCoordinate(
      zone.baseStartTime as unknown as Time,
    ) as Coordinate | null
    const leftX = startX ?? 0
    const rightX = chartWidth

    const topY = Math.min(proximalY, distalY)
    const bottomY = Math.max(proximalY, distalY)
    const height = bottomY - topY

    if (height < 1) return

    const color = getZoneColor(zone, isHigherTf)
    const opacity = zone.status === "invalidated" ? 0.04 : getZoneOpacity(zone.scores.total)

    ctx.save()

    // ─── Filled rectangle ───────────────────────────────────────────
    ctx.fillStyle = hexToRgba(color, opacity)
    ctx.fillRect(leftX, topY, rightX - leftX, height)

    // ─── Invalidated zones: hatched pattern ─────────────────────────
    if (zone.status === "invalidated") {
      ctx.strokeStyle = hexToRgba(color, 0.08)
      ctx.lineWidth = 0.5
      const step = 8
      for (let x = leftX; x < rightX + height; x += step) {
        ctx.beginPath()
        ctx.moveTo(x, topY)
        ctx.lineTo(x - height, bottomY)
        ctx.stroke()
      }
    }

    // ─── Proximal line (solid, thicker — entry level) ───────────────
    ctx.beginPath()
    ctx.strokeStyle = hexToRgba(color, zone.status === "invalidated" ? 0.2 : 0.6)
    ctx.lineWidth = isHigherTf ? 1 : 1.5
    if (isHigherTf) ctx.setLineDash([4, 4])
    ctx.moveTo(leftX, proximalY)
    ctx.lineTo(rightX, proximalY)
    ctx.stroke()
    ctx.setLineDash([])

    // ─── Distal line (dashed, thinner — stop loss level) ────────────
    ctx.beginPath()
    ctx.strokeStyle = hexToRgba(color, zone.status === "invalidated" ? 0.15 : 0.4)
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.moveTo(leftX, distalY)
    ctx.lineTo(rightX, distalY)
    ctx.stroke()
    ctx.setLineDash([])

    // ─── Nearest zone border highlight ──────────────────────────────
    if (isNearest && zone.status === "active") {
      ctx.beginPath()
      ctx.strokeStyle = hexToRgba(color, 0.35)
      ctx.lineWidth = 1.5
      ctx.strokeRect(leftX, topY, rightX - leftX, height)
    }

    // ─── Label pill (formation + score) ─────────────────────────────
    const label = isHigherTf
      ? `HTF ${zone.timeframe} · ${zone.formation} ${zone.scores.total.toFixed(1)}`
      : `${zone.formation} ${zone.scores.total.toFixed(1)}`
    ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, sans-serif"
    const textMetrics = ctx.measureText(label)
    const pad = 4
    const labelX = leftX + 4
    const labelY = topY + 2

    // Label background
    const pillW = textMetrics.width + pad * 2
    const pillH = 14
    ctx.fillStyle = isDark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)"
    ctx.beginPath()
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(labelX, labelY, pillW, pillH, 2)
    } else {
      ctx.rect(labelX, labelY, pillW, pillH)
    }
    ctx.fill()

    // Label border
    ctx.strokeStyle = hexToRgba(color, 0.5)
    ctx.lineWidth = 0.5
    ctx.stroke()

    // Formation + score text
    ctx.fillStyle = hexToRgba(color, zone.status === "invalidated" ? 0.5 : 1)
    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    ctx.fillText(label, labelX + pad, labelY + 2)

    ctx.restore()
  }
}

// ─── Primitive Class ────────────────────────────────────────────────────────

export class ZonePrimitive implements ISeriesPrimitive<Time> {
  private _zones: ZoneData[] = []
  private _higherTfZones: ZoneData[] = []
  private _isDark = true
  private _decimals = 5
  private _nearestDemandId: string | null = null
  private _nearestSupplyId: string | null = null
  private _chart: IChartApiBase<Time> | null = null
  private _series: ISeriesApi<SeriesType, Time> | null = null
  private _requestUpdate?: () => void
  private _paneView: ZonePaneView
  private _priceAxisViews: ISeriesPrimitiveAxisView[] = []
  private _onZoneClick?: (zone: ZoneData, x: number, y: number) => void

  constructor() {
    this._paneView = new ZonePaneView(this)
  }

  // Public getters for the renderer
  get zones(): ZoneData[] {
    return this._zones
  }
  get higherTfZones(): ZoneData[] {
    return this._higherTfZones
  }
  get isDark(): boolean {
    return this._isDark
  }
  get nearestDemandId(): string | null {
    return this._nearestDemandId
  }
  get nearestSupplyId(): string | null {
    return this._nearestSupplyId
  }
  get chart(): IChartApiBase<Time> | null {
    return this._chart
  }
  get series(): ISeriesApi<SeriesType, Time> | null {
    return this._series
  }

  attached(params: SeriesAttachedParameter<Time>): void {
    this._chart = params.chart
    this._series = params.series
    this._requestUpdate = params.requestUpdate
  }

  detached(): void {
    this._chart = null
    this._series = null
    this._requestUpdate = undefined
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView]
  }

  updateAllViews(): void {
    // Pane views reference this primitive directly
  }

  priceAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    return this._priceAxisViews
  }

  private _rebuildAxisViews(): void {
    const views: ISeriesPrimitiveAxisView[] = []
    const series = this._series
    if (!series) {
      this._priceAxisViews = []
      return
    }

    const allZones = [...this._zones, ...this._higherTfZones]
    const dec = this._decimals
    const isDark = this._isDark

    for (const zone of allZones) {
      const isHTF = this._higherTfZones.includes(zone)
      const color = getZoneColor(zone, isHTF)
      const bgColor = isDark ? darken(color) : lighten(color)
      const txtColor = color

      // Proximal label
      views.push(
        new ZoneAxisView(
          series,
          zone.proximalLine,
          zone.proximalLine.toFixed(dec),
          txtColor,
          bgColor,
        ),
      )
      // Distal label
      views.push(
        new ZoneAxisView(series, zone.distalLine, zone.distalLine.toFixed(dec), txtColor, bgColor),
      )
    }

    this._priceAxisViews = views
  }

  /** Set primary timeframe zones. */
  setZones(zones: ZoneData[], currentPrice: number, isDark: boolean, decimals?: number): void {
    this._zones = zones
    this._isDark = isDark
    if (decimals !== undefined) this._decimals = decimals

    // Find nearest demand/supply for highlight
    const activeDemand = zones.filter((z) => z.type === "demand" && z.status === "active")
    const activeSupply = zones.filter((z) => z.type === "supply" && z.status === "active")
    this._nearestDemandId =
      activeDemand.length > 0
        ? activeDemand.reduce((best, z) =>
            z.distanceFromPricePips < best.distanceFromPricePips ? z : best,
          ).id
        : null
    this._nearestSupplyId =
      activeSupply.length > 0
        ? activeSupply.reduce((best, z) =>
            z.distanceFromPricePips < best.distanceFromPricePips ? z : best,
          ).id
        : null

    this._rebuildAxisViews()
    this._requestUpdate?.()
  }

  /** Set higher-timeframe zones (rendered behind primary). */
  setHigherTfZones(zones: ZoneData[]): void {
    this._higherTfZones = zones
    this._rebuildAxisViews()
    this._requestUpdate?.()
  }

  /** Remove all zones. */
  clearAll(): void {
    this._zones = []
    this._higherTfZones = []
    this._nearestDemandId = null
    this._nearestSupplyId = null
    this._priceAxisViews = []
    this._requestUpdate?.()
  }

  /** Set click handler for zone interaction. */
  setOnZoneClick(handler: (zone: ZoneData, x: number, y: number) => void): void {
    this._onZoneClick = handler
  }

  /**
   * Hit-test a click position against zone rectangles.
   * Call this from a click event handler on the chart container.
   */
  hitTest(x: number, y: number): { externalId: string; zOrder: "bottom" } | null {
    if (!this._chart || !this._series) return null

    const allZones = [...this._zones, ...this._higherTfZones]
    for (const zone of allZones) {
      const proximalY = this._series.priceToCoordinate(zone.proximalLine)
      const distalY = this._series.priceToCoordinate(zone.distalLine)
      if (proximalY == null || distalY == null) continue

      const topY = Math.min(proximalY, distalY)
      const bottomY = Math.max(proximalY, distalY)

      if (y >= topY && y <= bottomY) {
        this._onZoneClick?.(zone, x, y)
        return { externalId: zone.id, zOrder: "bottom" }
      }
    }
    return null
  }
}
