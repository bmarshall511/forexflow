"use client"

import { useState, useEffect, useRef } from "react"
import { useDaemonStatus } from "./use-daemon-status"
import { getClientDaemonUrl } from "@/lib/daemon-url"

const DAEMON_URL = getClientDaemonUrl()
const POLL_INTERVAL = 5_000 // 5 seconds

interface LivePriceResult {
  bid: number | null
  ask: number | null
  /** Whether this is from a live WS stream (true) or REST poll / cached (false) */
  isStreaming: boolean
}

/** Validate a price value is a usable finite number (not NaN, Infinity, 0, etc.) */
function isValidPrice(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0
}

/**
 * Module-level price cache keyed by instrument.
 * Persists across component mount/unmount cycles (e.g. when a setup card moves
 * between the "approaching" and "active" filter groups, React unmounts and
 * remounts the component — useState and useRef reset, but this survives).
 */
const priceCache = new Map<string, { bid: number; ask: number }>()

/**
 * Get the live price for an instrument, combining WS streams with REST polling.
 *
 * Uses the shared daemon connection (context) — NOT a per-component WebSocket.
 * WS streams only cover instruments with open positions or active charts.
 * For other instruments (e.g. Trade Finder setups), this hook polls the daemon
 * REST endpoint every 5 seconds for fresh prices.
 *
 * A module-level cache ensures the price never flickers to null, even across
 * component unmount/remount cycles.
 */
export function useLivePrice(instrument: string): LivePriceResult {
  const { positionsPrices, chartPrices } = useDaemonStatus()
  const [polledPrice, setPolledPrice] = useState<{ bid: number; ask: number } | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check WS streams first (merged state — instruments accumulate, never flicker out)
  const wsTick =
    positionsPrices?.prices?.find((p) => p.instrument === instrument) ??
    chartPrices?.prices?.find((p) => p.instrument === instrument) ??
    null

  // Only poll if WS doesn't have this instrument
  const needsPoll = !wsTick
  useEffect(() => {
    if (!needsPoll) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    let mounted = true
    const fetchPrice = async () => {
      try {
        const res = await fetch(`${DAEMON_URL}/price/${instrument}`)
        const json = await res.json()
        if (mounted && json.ok && json.data) {
          const bid = json.data.bid as unknown
          const ask = json.data.ask as unknown
          if (isValidPrice(bid) && isValidPrice(ask)) {
            const price = { bid, ask }
            priceCache.set(instrument, price)
            setPolledPrice(price)
          }
        }
      } catch {
        // Non-critical — price will just be stale
      }
    }

    void fetchPrice()
    pollIntervalRef.current = setInterval(fetchPrice, POLL_INTERVAL)

    return () => {
      mounted = false
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [instrument, needsPoll])

  // Return chain: WS tick → polled price → module cache → null
  // The module cache survives component unmount/remount, preventing flicker.
  if (wsTick && isValidPrice(wsTick.bid) && isValidPrice(wsTick.ask)) {
    priceCache.set(instrument, { bid: wsTick.bid, ask: wsTick.ask })
    return { bid: wsTick.bid, ask: wsTick.ask, isStreaming: true }
  }

  if (polledPrice) {
    return { bid: polledPrice.bid, ask: polledPrice.ask, isStreaming: false }
  }

  const cached = priceCache.get(instrument)
  if (cached) {
    return { bid: cached.bid, ask: cached.ask, isStreaming: false }
  }

  return { bid: null, ask: null, isStreaming: false }
}
