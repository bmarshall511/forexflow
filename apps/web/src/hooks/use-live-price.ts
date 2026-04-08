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

/**
 * Get the live price for an instrument, combining WS streams with REST polling.
 *
 * Uses the shared daemon connection (context) — NOT a per-component WebSocket.
 * WS streams only cover instruments with open positions or active charts.
 * For other instruments (e.g. Trade Finder setups), this hook polls the daemon
 * REST endpoint every 5 seconds for fresh prices.
 *
 * A last-known-price ref ensures the price never flickers to null once a value
 * has been obtained from any source.
 */
export function useLivePrice(instrument: string): LivePriceResult {
  const { positionsPrices, chartPrices } = useDaemonStatus()
  const [polledPrice, setPolledPrice] = useState<{ bid: number; ask: number } | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastKnownRef = useRef<{ bid: number; ask: number } | null>(null)

  // Check WS streams first (merged state — instruments accumulate, never flicker out)
  const wsTick =
    positionsPrices?.prices?.find((p) => p.instrument === instrument) ??
    chartPrices?.prices?.find((p) => p.instrument === instrument) ??
    null

  // Only poll if WS doesn't have this instrument
  const needsPoll = !wsTick
  useEffect(() => {
    if (!needsPoll) {
      // WS has it — stop polling
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
          setPolledPrice({ bid: json.data.bid, ask: json.data.ask })
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

  // Return chain: WS tick → polled price → last known → null
  // Once a price is obtained, it never goes back to null (prevents flicker).
  if (wsTick) {
    lastKnownRef.current = { bid: wsTick.bid, ask: wsTick.ask }
    return { bid: wsTick.bid, ask: wsTick.ask, isStreaming: true }
  }

  if (polledPrice) {
    lastKnownRef.current = polledPrice
    return { bid: polledPrice.bid, ask: polledPrice.ask, isStreaming: false }
  }

  if (lastKnownRef.current) {
    return { bid: lastKnownRef.current.bid, ask: lastKnownRef.current.ask, isStreaming: false }
  }

  return { bid: null, ask: null, isStreaming: false }
}
