/**
 * CalendarFetcher — periodically fetches economic calendar events from Finnhub
 * and persists them to the database.
 *
 * If no Finnhub API key is configured, the fetcher degrades gracefully (no-op).
 * Uses a 4-hour interval which is well within Finnhub's free-tier rate limits.
 *
 * @module calendar-fetcher
 */
import { upsertEconomicEvents } from "@fxflow/db"
import type { EconomicEventInput } from "@fxflow/db"
import type { EconomicEventImpact } from "@fxflow/types"

const FETCH_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours
const _FETCH_TIMEOUT_MS = 15_000
const FINNHUB_BASE = "https://finnhub.io/api/v1"

/** Finnhub calendar/economic response shape */
interface FinnhubEconomicEvent {
  country: string
  date?: string // "YYYY-MM-DD" — present in Finnhub responses but not always documented
  event: string
  impact: string // "high" | "medium" | "low"
  actual?: number | null
  estimate?: number | null
  prev?: number | null
  time: string // "HH:mm:ss" or empty
  unit?: string
}

interface FinnhubCalendarResponse {
  economicCalendar?: FinnhubEconomicEvent[]
}

/** Map country codes to currency codes for common forex countries */
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "USD",
  EU: "EUR",
  GB: "GBP",
  JP: "JPY",
  AU: "AUD",
  CA: "CAD",
  CH: "CHF",
  NZ: "NZD",
  CN: "CNY",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  SG: "SGD",
  HK: "HKD",
  ZA: "ZAR",
  MX: "MXN",
  TR: "TRY",
  PL: "PLN",
  HU: "HUF",
  CZ: "CZK",
}

function mapImpact(impact: string): EconomicEventImpact {
  const lower = impact.toLowerCase()
  if (lower === "high") return "high"
  if (lower === "medium") return "medium"
  return "low"
}

function formatValue(val: number | null | undefined, unit?: string): string | null {
  if (val === null || val === undefined) return null
  if (unit === "%") return `${val}%`
  return String(val)
}

export class CalendarFetcher {
  private interval: ReturnType<typeof setInterval> | null = null
  private abortController: AbortController | null = null

  constructor(private getApiKey: () => Promise<string | null>) {}

  start(): void {
    if (this.interval) return
    console.log("[calendar-fetcher] Started (fetches every 4 hours)")

    // Fetch immediately on start
    void this.fetchEvents()

    this.interval = setInterval(() => {
      void this.fetchEvents()
    }, FETCH_INTERVAL_MS)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  private loggedNoKey = false

  async fetchEvents(): Promise<void> {
    const apiKey = await this.getApiKey()
    if (!apiKey) {
      if (!this.loggedNoKey) {
        console.log(
          "[calendar-fetcher] No FinnHub API key configured — calendar/news features disabled. " +
            "Set the key in Settings > AI to enable economic calendar data.",
        )
        this.loggedNoKey = true
      }
      return
    }
    this.loggedNoKey = false

    // Fetch events for the next 7 days
    const from = this.formatDate(new Date())
    const to = this.formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))

    this.abortController = new AbortController()
    const url = `${FINNHUB_BASE}/calendar/economic?from=${from}&to=${to}&token=${apiKey}`

    try {
      const response = await fetch(url, {
        signal: this.abortController.signal,
        headers: { Accept: "application/json" },
      })

      if (!response.ok) {
        const text = await response.text()
        console.error(
          `[calendar-fetcher] Finnhub API error ${response.status}: ${text.slice(0, 200)}`,
        )
        return
      }

      const data = (await response.json()) as FinnhubCalendarResponse

      // Handle both array and nested response formats from Finnhub
      // Some API versions return { economicCalendar: [...] }
      // Others return { economicCalendar: { result: [...] } }
      let rawEvents: FinnhubEconomicEvent[] = []
      const cal = data.economicCalendar
      if (Array.isArray(cal)) {
        rawEvents = cal
      } else if (cal && typeof cal === "object" && "result" in cal) {
        rawEvents = (cal as { result: FinnhubEconomicEvent[] }).result ?? []
      }

      if (rawEvents.length === 0) {
        console.log(
          `[calendar-fetcher] No events returned from Finnhub (response keys: ${Object.keys(data).join(", ")})`,
        )
        return
      }

      // Log first event shape on first successful fetch for diagnostics
      if (rawEvents.length > 0) {
        const sample = rawEvents[0]!
        console.log(
          `[calendar-fetcher] Fetched ${rawEvents.length} events. Sample fields: ${Object.keys(sample).join(", ")}`,
        )
      }

      const events: EconomicEventInput[] = []
      let skippedTimestamp = 0
      for (const raw of rawEvents) {
        if (!raw.event || !raw.country) continue

        const currency = COUNTRY_TO_CURRENCY[raw.country] ?? raw.country
        // Finnhub returns date in the event's `time` field as "HH:mm:ss"
        // and the date comes from the query range. We need to parse the full timestamp.
        // The `time` field may be empty — default to midnight.
        const timestamp = this.parseEventTimestamp(from, to, raw)
        if (!timestamp) {
          skippedTimestamp++
          continue
        }

        events.push({
          title: raw.event,
          currency,
          impact: mapImpact(raw.impact),
          actual: formatValue(raw.actual, raw.unit),
          forecast: formatValue(raw.estimate, raw.unit),
          previous: formatValue(raw.prev, raw.unit),
          timestamp,
        })
      }

      const count = await upsertEconomicEvents(events)
      console.log(
        `[calendar-fetcher] Upserted ${count} events (${rawEvents.length} from Finnhub` +
          `${skippedTimestamp > 0 ? `, ${skippedTimestamp} skipped due to timestamp parse failure` : ""})`,
      )
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      console.error("[calendar-fetcher] Fetch failed:", (err as Error).message)
    } finally {
      this.abortController = null
    }
  }

  /**
   * Parse event timestamp from Finnhub economic calendar event.
   * Finnhub returns a `date` field (YYYY-MM-DD) and a `time` field (HH:mm:ss).
   */
  private parseEventTimestamp(_from: string, _to: string, raw: FinnhubEconomicEvent): Date | null {
    try {
      const dateStr = raw.date ?? _from
      const timeStr = raw.time || "00:00:00"
      const parsed = new Date(`${dateStr}T${timeStr}Z`)
      if (isNaN(parsed.getTime())) {
        console.warn(
          `[calendar-fetcher] Invalid timestamp for "${raw.event}": date=${dateStr} time=${timeStr}`,
        )
        return null
      }
      return parsed
    } catch (err) {
      console.warn(
        `[calendar-fetcher] Failed to parse timestamp for "${raw.event}":`,
        (err as Error).message,
      )
      return null
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0]!
  }
}
