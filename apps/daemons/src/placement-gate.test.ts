import { describe, it, expect, vi, beforeEach } from "vitest"
import { PlacementGate } from "./placement-gate"
import type { PositionManager } from "./positions/position-manager"

function makePositionManager(
  open: Array<{ instrument: string }> = [],
  pending: Array<{ instrument: string }> = [],
): PositionManager {
  return {
    getPositions: () => ({
      open,
      pending,
      closed: [],
      lastUpdated: new Date().toISOString(),
    }),
  } as unknown as PositionManager
}

describe("PlacementGate", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("allows acquisition when no positions or locks exist", () => {
    const gate = new PlacementGate(makePositionManager())
    const result = gate.acquire("EUR_USD", "trade_finder")

    expect(result).toEqual({ allowed: true })
    expect(gate.activeLockCount).toBe(1)
  })

  it("rejects when an open trade exists on the instrument", () => {
    const gate = new PlacementGate(makePositionManager([{ instrument: "EUR_USD" }]))
    const result = gate.acquire("EUR_USD", "trade_finder")

    expect(result).toEqual({
      allowed: false,
      reason: "Existing open trade on EUR_USD",
    })
    expect(gate.activeLockCount).toBe(0)
  })

  it("rejects when a pending order exists on the instrument", () => {
    const gate = new PlacementGate(makePositionManager([], [{ instrument: "EUR_USD" }]))
    const result = gate.acquire("EUR_USD", "trade_finder")

    expect(result).toEqual({
      allowed: false,
      reason: "Existing pending order on EUR_USD",
    })
  })

  it("rejects when another source holds a lock on the instrument", () => {
    const gate = new PlacementGate(makePositionManager())

    gate.acquire("EUR_USD", "trade_finder")
    const result = gate.acquire("EUR_USD", "ai_trader")

    expect(result).toEqual({
      allowed: false,
      reason: "trade_finder is already placing on EUR_USD",
    })
  })

  it("allows re-acquisition by the same source", () => {
    const gate = new PlacementGate(makePositionManager())

    gate.acquire("EUR_USD", "trade_finder")
    const result = gate.acquire("EUR_USD", "trade_finder")

    expect(result).toEqual({ allowed: true })
    expect(gate.activeLockCount).toBe(1)
  })

  it("allows acquisition on different instruments concurrently", () => {
    const gate = new PlacementGate(makePositionManager())

    const r1 = gate.acquire("EUR_USD", "trade_finder")
    const r2 = gate.acquire("GBP_USD", "ai_trader")

    expect(r1).toEqual({ allowed: true })
    expect(r2).toEqual({ allowed: true })
    expect(gate.activeLockCount).toBe(2)
  })

  it("releases a lock correctly", () => {
    const gate = new PlacementGate(makePositionManager())

    gate.acquire("EUR_USD", "trade_finder")
    expect(gate.activeLockCount).toBe(1)

    gate.release("EUR_USD", "trade_finder")
    expect(gate.activeLockCount).toBe(0)
  })

  it("does not release a lock held by a different source", () => {
    const gate = new PlacementGate(makePositionManager())

    gate.acquire("EUR_USD", "trade_finder")
    gate.release("EUR_USD", "ai_trader")

    expect(gate.activeLockCount).toBe(1)
  })

  it("release is a no-op for an instrument with no lock", () => {
    const gate = new PlacementGate(makePositionManager())

    gate.release("EUR_USD", "trade_finder")
    expect(gate.activeLockCount).toBe(0)
  })

  it("allows acquisition after release", () => {
    const gate = new PlacementGate(makePositionManager())

    gate.acquire("EUR_USD", "trade_finder")
    gate.release("EUR_USD", "trade_finder")

    const result = gate.acquire("EUR_USD", "ai_trader")
    expect(result).toEqual({ allowed: true })
  })

  describe("TTL expiry", () => {
    it("prunes stale locks on acquire", () => {
      vi.useFakeTimers()
      const gate = new PlacementGate(makePositionManager())

      gate.acquire("EUR_USD", "trade_finder")
      expect(gate.activeLockCount).toBe(1)

      // Advance past TTL (10s)
      vi.advanceTimersByTime(11_000)

      // The stale lock should be pruned during the next acquire call
      const result = gate.acquire("EUR_USD", "ai_trader")
      expect(result).toEqual({ allowed: true })
      expect(gate.activeLockCount).toBe(1)

      vi.useRealTimers()
    })

    it("does not prune locks that have not expired", () => {
      vi.useFakeTimers()
      const gate = new PlacementGate(makePositionManager())

      gate.acquire("EUR_USD", "trade_finder")

      // Advance less than TTL
      vi.advanceTimersByTime(5_000)

      const result = gate.acquire("EUR_USD", "ai_trader")
      expect(result).toEqual({
        allowed: false,
        reason: "trade_finder is already placing on EUR_USD",
      })

      vi.useRealTimers()
    })
  })

  it("checks positions fresh on each acquire call", () => {
    const pm = makePositionManager()
    const gate = new PlacementGate(pm)

    // First call: no positions, acquire succeeds
    const r1 = gate.acquire("EUR_USD", "trade_finder")
    expect(r1).toEqual({ allowed: true })
    gate.release("EUR_USD", "trade_finder")

    // Mutate position manager to return an open trade
    vi.spyOn(pm, "getPositions").mockReturnValue({
      open: [{ instrument: "EUR_USD" }],
      pending: [],
      closed: [],
      lastUpdated: new Date().toISOString(),
    } as unknown as ReturnType<PositionManager["getPositions"]>)

    const r2 = gate.acquire("EUR_USD", "ai_trader")
    expect(r2).toEqual({
      allowed: false,
      reason: "Existing open trade on EUR_USD",
    })
  })
})
