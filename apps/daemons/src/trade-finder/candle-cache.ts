import type { ZoneCandle } from "@fxflow/types"

interface CacheEntry {
  candles: ZoneCandle[]
  fetchedAt: number
}

/** TTL per timeframe in ms */
const TTL_MAP: Record<string, number> = {
  M1: 60_000,
  M5: 5 * 60_000,
  M15: 15 * 60_000,
  M30: 30 * 60_000,
  H1: 60 * 60_000,
  H4: 4 * 60 * 60_000,
  D: 24 * 60 * 60_000,
  W: 7 * 24 * 60 * 60_000,
  M: 30 * 24 * 60 * 60_000,
}

function getTTL(timeframe: string): number {
  return TTL_MAP[timeframe] ?? 60_000
}

/**
 * In-memory candle cache to prevent redundant OANDA API calls
 * during multi-pair scanning. Keys are `instrument:timeframe:count`.
 */
export class CandleCache {
  private cache = new Map<string, CacheEntry>()

  private key(instrument: string, timeframe: string, count: number): string {
    return `${instrument}:${timeframe}:${count}`
  }

  get(instrument: string, timeframe: string, count: number): ZoneCandle[] | null {
    const entry = this.cache.get(this.key(instrument, timeframe, count))
    if (!entry) return null
    if (Date.now() - entry.fetchedAt > getTTL(timeframe)) {
      this.cache.delete(this.key(instrument, timeframe, count))
      return null
    }
    return entry.candles
  }

  set(instrument: string, timeframe: string, count: number, candles: ZoneCandle[]): void {
    this.cache.set(this.key(instrument, timeframe, count), {
      candles,
      fetchedAt: Date.now(),
    })
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

/**
 * Fetch candles from OANDA REST API, returning ZoneCandle format.
 * Uses the cache to avoid redundant calls.
 */
export async function fetchOandaCandles(
  instrument: string,
  timeframe: string,
  count: number,
  apiUrl: string,
  token: string,
  cache: CandleCache,
): Promise<ZoneCandle[]> {
  const cached = cache.get(instrument, timeframe, count)
  if (cached) return cached

  try {
    const url = `${apiUrl}/v3/instruments/${instrument}/candles?granularity=${timeframe}&count=${count}&price=M`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      console.warn(`[trade-finder] Candle fetch failed: ${instrument} ${timeframe} HTTP ${response.status}`)
      return []
    }

    const data = (await response.json()) as {
      candles?: Array<{
        time: string
        mid?: { o: string; h: string; l: string; c: string }
        complete: boolean
      }>
    }

    const candles: ZoneCandle[] = (data.candles ?? [])
      .filter((c) => c.complete && c.mid)
      .map((c) => ({
        time: Math.floor(new Date(c.time).getTime() / 1000),
        open: parseFloat(c.mid!.o),
        high: parseFloat(c.mid!.h),
        low: parseFloat(c.mid!.l),
        close: parseFloat(c.mid!.c),
      }))

    if (candles.length > 0) {
      cache.set(instrument, timeframe, count, candles)
    }

    return candles
  } catch (err) {
    console.warn(`[trade-finder] Candle fetch error: ${instrument} ${timeframe}`, err)
    return []
  }
}
