"use client"

import { useState, useEffect, useRef } from "react"
import { useDaemonConnection } from "./use-daemon-connection"
import { getClientDaemonUrl } from "@/lib/daemon-url"

const DAEMON_URL = getClientDaemonUrl()
const POLL_INTERVAL = 5_000 // 5 seconds

interface LivePriceResult {
  bid: number | null
  ask: number | null
  /** Whether this is from a live WS stream (true) or REST poll (false) */
  isStreaming: boolean
}

/**
 * Get the live price for an instrument, combining WS streams with REST polling.
 *
 * WS streams only cover instruments with open positions or active charts.
 * For Trade Finder setups on other instruments, this hook polls the daemon
 * REST endpoint every 5 seconds for fresh prices.
 */
export function useLivePrice(instrument: string): LivePriceResult {
  const { positionsPrices, chartPrices } = useDaemonConnection()
  const [polledPrice, setPolledPrice] = useState<{ bid: number; ask: number } | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check WS streams first
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

  if (wsTick) {
    return { bid: wsTick.bid, ask: wsTick.ask, isStreaming: true }
  }

  if (polledPrice) {
    return { bid: polledPrice.bid, ask: polledPrice.ask, isStreaming: false }
  }

  return { bid: null, ask: null, isStreaming: false }
}
