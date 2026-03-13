import { NextResponse, type NextRequest } from "next/server"
import { revealToken, getSettings, upsertZones } from "@fxflow/db"
import { detectZones, getHigherTimeframe } from "@fxflow/shared"
import type { TradingMode, ZoneDetectionConfig, ZoneDetectionResult, MultiTimeframeZoneResult, CurveAlignment, ZoneCandle } from "@fxflow/types"
import { ZONE_PRESETS } from "@fxflow/shared"

const OANDA_URLS: Record<TradingMode, string> = {
  practice: "https://api-fxpractice.oanda.com",
  live: "https://api-fxtrade.oanda.com",
}

interface OandaCandle {
  complete: boolean
  time: string
  mid: { o: string; h: string; l: string; c: string }
}

async function fetchOandaCandles(
  instrument: string,
  granularity: string,
  count: number,
  baseUrl: string,
  token: string,
): Promise<ZoneCandle[]> {
  const url = `${baseUrl}/v3/instruments/${instrument}/candles?granularity=${granularity}&count=${count}&price=M`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  })
  if (!res.ok) throw new Error(`OANDA ${res.status}`)
  const data = (await res.json()) as { candles: OandaCandle[] }
  return data.candles
    .filter((c) => c.complete)
    .map((c) => ({
      time: Math.floor(new Date(c.time).getTime() / 1000),
      open: parseFloat(c.mid.o),
      high: parseFloat(c.mid.h),
      low: parseFloat(c.mid.l),
      close: parseFloat(c.mid.c),
    }))
}

function computeCurveAlignment(
  primary: ZoneDetectionResult,
  higher: ZoneDetectionResult | null,
): CurveAlignment {
  if (!higher) return "neutral"

  const htfDemand = higher.zones.find((z) => z.type === "demand" && z.status === "active")
  const htfSupply = higher.zones.find((z) => z.type === "supply" && z.status === "active")

  if (!htfDemand && !htfSupply) return "neutral"

  // Check if price is near a higher-TF zone
  const priceNearHtfDemand = htfDemand && primary.currentPrice - htfDemand.proximalLine < htfDemand.width * 3
  const priceNearHtfSupply = htfSupply && htfSupply.proximalLine - primary.currentPrice < htfSupply.width * 3

  const primaryHasDemand = primary.nearestDemand !== null
  const primaryHasSupply = primary.nearestSupply !== null

  if (priceNearHtfDemand && primaryHasDemand) return "aligned"
  if (priceNearHtfSupply && primaryHasSupply) return "aligned"
  if (priceNearHtfDemand && primaryHasSupply && !primaryHasDemand) return "conflicting"
  if (priceNearHtfSupply && primaryHasDemand && !primaryHasSupply) return "conflicting"

  return "neutral"
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instrument: string }> },
): Promise<NextResponse> {
  try {
    const { instrument } = await params
    const { searchParams } = request.nextUrl
    const timeframe = searchParams.get("timeframe") ?? "H1"
    const lookback = parseInt(searchParams.get("lookback") ?? "500", 10)
    const minScore = parseFloat(searchParams.get("minScore") ?? "0")
    const maxPerType = parseInt(searchParams.get("maxPerType") ?? "10", 10)
    const showInvalidated = searchParams.get("showInvalidated") === "true"
    const higherTf = searchParams.get("higherTf") === "true"
    const additionalTfs = searchParams.get("additionalTfs")?.split(",").filter(Boolean) ?? []

    // Parse algorithm config from query or use standard preset
    const preset = (searchParams.get("preset") as keyof typeof ZONE_PRESETS) ?? "standard"
    const configJson = searchParams.get("config")
    let config: ZoneDetectionConfig
    if (configJson) {
      try {
        config = JSON.parse(configJson) as ZoneDetectionConfig
      } catch {
        config = ZONE_PRESETS[preset] ?? ZONE_PRESETS.standard
      }
    } else {
      config = ZONE_PRESETS[preset] ?? ZONE_PRESETS.standard
    }

    const settings = await getSettings()
    const mode = settings.tradingMode
    const token = await revealToken(mode)
    const baseUrl = OANDA_URLS[mode]

    // Fetch primary timeframe candles
    const candles = await fetchOandaCandles(instrument, timeframe, lookback, baseUrl, token)
    if (candles.length === 0) {
      return NextResponse.json({ ok: true, data: { primary: { instrument, timeframe, zones: [], nearestDemand: null, nearestSupply: null, currentPrice: 0, candlesAnalyzed: 0, computedAt: new Date().toISOString() }, higher: null, additional: [], curveAlignment: "neutral" } })
    }

    const currentPrice = candles[candles.length - 1]!.close

    // Detect primary zones
    const primary = detectZones(candles, instrument, timeframe, config, currentPrice)

    // Filter by score and status
    let filteredZones = primary.zones.filter((z) => z.scores.total >= minScore)
    if (!showInvalidated) {
      filteredZones = filteredZones.filter((z) => z.status !== "invalidated")
    }

    // Limit per type
    const demandZones = filteredZones.filter((z) => z.type === "demand").slice(0, maxPerType)
    const supplyZones = filteredZones.filter((z) => z.type === "supply").slice(0, maxPerType)
    const finalZones = [...demandZones, ...supplyZones]

    const primaryResult: ZoneDetectionResult = {
      ...primary,
      zones: finalZones,
      nearestDemand: demandZones[0] ?? null,
      nearestSupply: supplyZones[0] ?? null,
    }

    // Persist to DB (all detected zones, not just filtered)
    await upsertZones(instrument, timeframe, primary.zones).catch((err) => {
      console.error("[zones] Failed to persist zones:", err)
    })

    // Higher timeframe zones
    let higherResult: ZoneDetectionResult | null = null
    if (higherTf) {
      const htf = getHigherTimeframe(timeframe)
      if (htf) {
        try {
          const htfCandles = await fetchOandaCandles(instrument, htf, Math.min(lookback, 200), baseUrl, token)
          if (htfCandles.length > 0) {
            const htfPrice = htfCandles[htfCandles.length - 1]!.close
            higherResult = detectZones(htfCandles, instrument, htf, config, htfPrice)
            let htfFiltered = higherResult.zones.filter((z) => z.scores.total >= minScore)
            if (!showInvalidated) htfFiltered = htfFiltered.filter((z) => z.status !== "invalidated")
            higherResult = { ...higherResult, zones: htfFiltered.slice(0, maxPerType * 2) }
            await upsertZones(instrument, htf, higherResult.zones).catch(() => {})
          }
        } catch (err) {
          console.error("[zones] Failed to fetch higher-TF zones:", err)
        }
      }
    }

    // Additional timeframes
    const additionalResults: ZoneDetectionResult[] = []
    for (const tf of additionalTfs) {
      try {
        const tfCandles = await fetchOandaCandles(instrument, tf, Math.min(lookback, 200), baseUrl, token)
        if (tfCandles.length > 0) {
          const tfPrice = tfCandles[tfCandles.length - 1]!.close
          let result = detectZones(tfCandles, instrument, tf, config, tfPrice)
          let filtered = result.zones.filter((z) => z.scores.total >= minScore)
          if (!showInvalidated) filtered = filtered.filter((z) => z.status !== "invalidated")
          result = { ...result, zones: filtered.slice(0, maxPerType * 2) }
          additionalResults.push(result)
          await upsertZones(instrument, tf, result.zones).catch(() => {})
        }
      } catch (err) {
        console.error(`[zones] Failed to fetch ${tf} zones:`, err)
      }
    }

    const curveAlignment = computeCurveAlignment(primaryResult, higherResult)

    const result: MultiTimeframeZoneResult = {
      primary: primaryResult,
      higher: higherResult,
      additional: additionalResults,
      curveAlignment,
    }

    return NextResponse.json(
      { ok: true, data: result },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
    )
  } catch (error) {
    console.error("[GET /api/zones/[instrument]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
