import { getCachedMarketData, setCachedMarketData, cleanupExpiredData } from "@fxflow/db"
import { getDecryptedAiTraderKey } from "@fxflow/db"
import type {
  AiTraderMarketDataType,
  EconomicCalendarEvent,
  NewsSentimentData,
} from "@fxflow/types"

// ─── Cache TTLs ──────────────────────────────────────────────────────────────

const TTL_HOURS: Record<AiTraderMarketDataType, number> = {
  economic_calendar: 4,
  news_sentiment: 1,
  fred_macro: 24,
  cot_positioning: 168, // Weekly COT report
  correlation_matrix: 12,
}

function ttlMs(dataType: AiTraderMarketDataType): number {
  return (TTL_HOURS[dataType] ?? 4) * 3_600_000
}

// ─── Fetchers ────────────────────────────────────────────────────────────────

/**
 * Fetch upcoming high-impact economic events from a free calendar API.
 * Uses Forex Factory RSS / Trading Economics free tier as fallback.
 */
async function fetchEconomicCalendar(): Promise<EconomicCalendarEvent[]> {
  // Alpha Vantage doesn't have a calendar endpoint, so we fetch from a public
  // forex economic calendar. Using a lightweight approach:
  // For production, this would integrate with Finnhub's calendar endpoint.
  try {
    const response = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return []
    const events = (await response.json()) as Array<{
      title: string
      country: string
      date: string
      impact: string
      forecast: string
      previous: string
      actual?: string
    }>
    return events
      .filter((e) => e.impact === "High" || e.impact === "Medium")
      .map((e) => ({
        title: e.title,
        country: e.country,
        currency: countryCurrencyMap(e.country),
        impact: e.impact === "High" ? ("high" as const) : ("medium" as const),
        actual: e.actual ?? null,
        forecast: e.forecast || null,
        previous: e.previous || null,
        timestamp: e.date,
      }))
  } catch (err) {
    console.warn("[ai-trader] Calendar fetch error:", (err as Error).message)
    return []
  }
}

function countryCurrencyMap(country: string): string {
  const map: Record<string, string> = {
    USD: "USD",
    EUR: "EUR",
    GBP: "GBP",
    JPY: "JPY",
    AUD: "AUD",
    CAD: "CAD",
    CHF: "CHF",
    NZD: "NZD",
    CNY: "CNY",
    // Country name mappings
    "United States": "USD",
    Eurozone: "EUR",
    "United Kingdom": "GBP",
    Japan: "JPY",
    Australia: "AUD",
    Canada: "CAD",
    Switzerland: "CHF",
    "New Zealand": "NZD",
    China: "CNY",
  }
  return map[country] ?? country
}

/**
 * Fetch news sentiment for a currency from Alpha Vantage.
 */
async function fetchNewsSentiment(currency: string): Promise<NewsSentimentData | null> {
  const apiKey = await getDecryptedAiTraderKey("alphaVantage")
  if (!apiKey) return null

  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=FOREX:${currency}&apikey=${apiKey}&limit=10`,
      { signal: AbortSignal.timeout(15_000) },
    )
    if (!response.ok) return null

    const data = (await response.json()) as {
      feed?: Array<{
        title: string
        overall_sentiment_score: number
        overall_sentiment_label: string
      }>
    }
    if (!data.feed || data.feed.length === 0) return null

    const scores = data.feed.map((a) => a.overall_sentiment_score)
    const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length
    const normalizedScore = Math.round(avgScore * 100) // -100 to 100

    return {
      subject: currency,
      sentiment: normalizedScore > 15 ? "bullish" : normalizedScore < -15 ? "bearish" : "neutral",
      score: normalizedScore,
      articleCount: data.feed.length,
      topHeadlines: data.feed.slice(0, 3).map((a) => a.title),
      fetchedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.warn(`[ai-trader] News sentiment fetch error for ${currency}:`, (err as Error).message)
    return null
  }
}

/**
 * Fetch FRED macro data (e.g., interest rates, GDP, CPI).
 */
async function fetchFredData(seriesId: string): Promise<unknown> {
  const apiKey = await getDecryptedAiTraderKey("fred")
  if (!apiKey) return null

  try {
    const response = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`,
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!response.ok) return null

    const data = (await response.json()) as {
      observations?: Array<{ date: string; value: string }>
    }
    return data.observations ?? []
  } catch (err) {
    console.warn(`[ai-trader] FRED fetch error for ${seriesId}:`, (err as Error).message)
    return null
  }
}

// ─── Public Interface ────────────────────────────────────────────────────────

/**
 * DataAggregator fetches and caches external market data for AI analysis.
 * All data is cached in the DB with configurable TTLs.
 */
export class DataAggregator {
  /**
   * Get economic calendar events (cached).
   */
  async getCalendar(): Promise<EconomicCalendarEvent[]> {
    const cached = await getCachedMarketData("economic_calendar", "this_week")
    if (cached) return cached.data as EconomicCalendarEvent[]

    const events = await fetchEconomicCalendar()
    if (events.length > 0) {
      await setCachedMarketData(
        "economic_calendar",
        "this_week",
        events,
        ttlMs("economic_calendar"),
      )
    }
    return events
  }

  /**
   * Get upcoming high-impact events for a specific currency.
   */
  async getUpcomingEventsForCurrency(currency: string): Promise<EconomicCalendarEvent[]> {
    const events = await this.getCalendar()
    const now = new Date()
    return events.filter((e) => e.currency === currency && new Date(e.timestamp) > now)
  }

  /**
   * Check if there's a high-impact event within N minutes for a currency.
   */
  async hasUpcomingHighImpact(currency: string, withinMinutes: number): Promise<boolean> {
    const events = await this.getUpcomingEventsForCurrency(currency)
    const cutoff = new Date(Date.now() + withinMinutes * 60_000)
    return events.some((e) => e.impact === "high" && new Date(e.timestamp) <= cutoff)
  }

  /**
   * Get news sentiment for a currency (cached).
   */
  async getNewsSentiment(currency: string): Promise<NewsSentimentData | null> {
    const cached = await getCachedMarketData("news_sentiment", currency)
    if (cached) return cached.data as NewsSentimentData

    const sentiment = await fetchNewsSentiment(currency)
    if (sentiment) {
      await setCachedMarketData("news_sentiment", currency, sentiment, ttlMs("news_sentiment"))
    }
    return sentiment
  }

  /**
   * Get FRED macro data for key series affecting a currency.
   */
  async getMacroData(currency: string): Promise<Record<string, unknown>> {
    const seriesMap: Record<string, string[]> = {
      USD: ["FEDFUNDS", "CPIAUCSL", "GDP", "UNRATE"],
      EUR: ["ECBDFR"],
      GBP: ["BOGZ1FL072052006Q"],
      JPY: ["BOGZ1FL072052006Q"],
    }

    const seriesIds = seriesMap[currency] ?? []
    const result: Record<string, unknown> = {}

    for (const seriesId of seriesIds) {
      const cacheKey = `fred_${seriesId}`
      const cached = await getCachedMarketData("fred_macro", cacheKey)
      if (cached) {
        result[seriesId] = cached.data
        continue
      }

      const data = await fetchFredData(seriesId)
      if (data) {
        await setCachedMarketData("fred_macro", cacheKey, data, ttlMs("fred_macro"))
        result[seriesId] = data
      }
    }

    return result
  }

  /**
   * Build a complete fundamental data snapshot for a currency pair.
   */
  async buildFundamentalSnapshot(instrument: string): Promise<{
    calendar: EconomicCalendarEvent[]
    sentiment: Record<string, NewsSentimentData | null>
    macro: Record<string, unknown>
  }> {
    const [base, quote] = instrument.split("_") as [string, string]

    const [calendar, baseSentiment, quoteSentiment, baseMacro, quoteMacro] = await Promise.all([
      this.getCalendar(),
      this.getNewsSentiment(base),
      this.getNewsSentiment(quote),
      this.getMacroData(base),
      this.getMacroData(quote),
    ])

    const relevantCalendar = calendar.filter((e) => e.currency === base || e.currency === quote)

    return {
      calendar: relevantCalendar,
      sentiment: { [base]: baseSentiment, [quote]: quoteSentiment },
      macro: { [base]: baseMacro, [quote]: quoteMacro },
    }
  }

  /** Cleanup expired cache entries. */
  async cleanup(): Promise<void> {
    await cleanupExpiredData()
  }
}
