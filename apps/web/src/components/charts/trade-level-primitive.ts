import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  IChartApiBase,
  ISeriesApi,
  SeriesType,
  Coordinate,
} from "lightweight-charts"

export interface TradeLevel {
  time: Time
  price: number
  label: string
  color: string
  decimals: number
}

class TradeLevelPaneView implements IPrimitivePaneView {
  private _source: TradeLevelPrimitive

  constructor(source: TradeLevelPrimitive) {
    this._source = source
  }

  zOrder(): "top" {
    return "top"
  }

  renderer(): IPrimitivePaneRenderer | null {
    return new TradeLevelPaneRenderer(this._source)
  }
}

class TradeLevelPaneRenderer implements IPrimitivePaneRenderer {
  private _source: TradeLevelPrimitive

  constructor(source: TradeLevelPrimitive) {
    this._source = source
  }

  draw(target: {
    useMediaCoordinateSpace: <T>(fn: (scope: { context: CanvasRenderingContext2D }) => T) => T
  }): void {
    const { chart, series, levels } = this._source
    if (!chart || !series || levels.length === 0) return

    target.useMediaCoordinateSpace(({ context }) => {
      const timeScale = chart.timeScale()
      const barSpacing: number =
        (timeScale as unknown as { options(): { barSpacing: number } }).options().barSpacing ?? 6
      const halfBar = Math.max(barSpacing * 0.45, 5)

      for (const level of levels) {
        const x = timeScale.timeToCoordinate(level.time) as Coordinate | null
        const y = series.priceToCoordinate(level.price) as Coordinate | null
        if (x == null || y == null) continue

        context.save()

        // ─── Horizontal line at exact price on the candle ───
        context.beginPath()
        context.strokeStyle = level.color
        context.lineWidth = 2
        context.moveTo(x - halfBar, y)
        context.lineTo(x + halfBar, y)
        context.stroke()

        // Small dot at center for emphasis
        context.beginPath()
        context.fillStyle = level.color
        context.arc(x, y, 2.5, 0, Math.PI * 2)
        context.fill()

        // ─── Label pill: "Entry  1.08502" ───
        const text = `${level.label}  ${level.price.toFixed(level.decimals)}`
        context.font = "bold 9px -apple-system, BlinkMacSystemFont, sans-serif"
        const metrics = context.measureText(text)
        const textW = metrics.width
        const pad = 4
        const labelX = x + halfBar + 6
        const labelY = y

        // Background pill
        const pillX = labelX - pad
        const pillY = labelY - 7
        const pillW = textW + pad * 2
        const pillH = 14

        context.fillStyle = level.color + "18"
        context.beginPath()
        if (typeof context.roundRect === "function") {
          context.roundRect(pillX, pillY, pillW, pillH, 2)
        } else {
          context.rect(pillX, pillY, pillW, pillH)
        }
        context.fill()

        // Pill border
        context.strokeStyle = level.color + "40"
        context.lineWidth = 0.5
        context.stroke()

        // Text
        context.fillStyle = level.color
        context.textAlign = "left"
        context.textBaseline = "middle"
        context.fillText(text, labelX, labelY)

        context.restore()
      }
    })
  }
}

export class TradeLevelPrimitive implements ISeriesPrimitive<Time> {
  private _levels: TradeLevel[] = []
  private _chart: IChartApiBase<Time> | null = null
  private _series: ISeriesApi<SeriesType, Time> | null = null
  private _requestUpdate?: () => void
  private _paneView: TradeLevelPaneView

  constructor() {
    this._paneView = new TradeLevelPaneView(this)
  }

  get levels(): TradeLevel[] {
    return this._levels
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
    // Pane views reference this primitive directly — no caching needed
  }

  setLevels(levels: TradeLevel[]): void {
    this._levels = levels
    this._requestUpdate?.()
  }
}
