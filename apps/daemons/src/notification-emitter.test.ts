import { describe, it, expect, vi, beforeEach } from "vitest"
import { NotificationEmitter } from "./notification-emitter"
import type { OandaHealthData, AnyDaemonMessage } from "@fxflow/types"

// Mock @fxflow/db
vi.mock("@fxflow/db", () => ({
  createNotification: vi.fn().mockImplementation((input) =>
    Promise.resolve({
      id: "test-id",
      severity: input.severity,
      source: input.source,
      title: input.title,
      message: input.message,
      dismissed: false,
      createdAt: new Date().toISOString(),
    }),
  ),
  cleanupOldNotifications: vi.fn().mockResolvedValue(0),
}))

import { createNotification } from "@fxflow/db"

function makeOandaData(overrides: Partial<OandaHealthData> = {}): OandaHealthData {
  return {
    status: "connected",
    streamConnected: true,
    apiReachable: true,
    accountValid: true,
    marginCallActive: false,
    marginCallPercent: 0,
    balance: 10000,
    marginAvailable: 9000,
    openTradeCount: 0,
    openPositionCount: 0,
    pendingOrderCount: 0,
    lastHealthCheck: new Date().toISOString(),
    errorMessage: null,
    tradingMode: "practice",
    ...overrides,
  }
}

describe("NotificationEmitter", () => {
  let oandaListeners: ((data: OandaHealthData) => void)[]
  let broadcastedMessages: AnyDaemonMessage[]
  let emitter: NotificationEmitter

  beforeEach(() => {
    vi.clearAllMocks()
    oandaListeners = []
    broadcastedMessages = []

    const mockStateManager = {
      onOandaChange: (fn: (data: OandaHealthData) => void) => {
        oandaListeners.push(fn)
      },
    } as never

    const mockBroadcast = (msg: AnyDaemonMessage) => {
      broadcastedMessages.push(msg)
    }

    emitter = new NotificationEmitter(mockStateManager, mockBroadcast)
    emitter.start()
  })

  function triggerOanda(data: OandaHealthData) {
    for (const fn of oandaListeners) {
      fn(data)
    }
  }

  it("does not emit on first OANDA update (no previous state)", () => {
    triggerOanda(makeOandaData({ apiReachable: true, streamConnected: true }))

    expect(createNotification).not.toHaveBeenCalled()
    expect(broadcastedMessages).toHaveLength(0)
  })

  it("emits critical notification when API becomes unreachable", async () => {
    // First update — establishes baseline
    triggerOanda(makeOandaData({ apiReachable: true }))
    // Second update — API goes down
    triggerOanda(makeOandaData({ apiReachable: false, errorMessage: "Connection refused" }))

    // Wait for async emit
    await vi.waitFor(() => {
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: "critical",
          source: "oanda_api",
          title: "OANDA API Disconnected",
        }),
      )
    })
    expect(broadcastedMessages).toHaveLength(1)
    expect(broadcastedMessages[0]!.type).toBe("notification_created")
  })

  it("emits info notification when API reconnects", async () => {
    triggerOanda(makeOandaData({ apiReachable: false }))
    triggerOanda(makeOandaData({ apiReachable: true }))

    await vi.waitFor(() => {
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: "info",
          source: "oanda_api",
          title: "OANDA API Reconnected",
        }),
      )
    })
  })

  it("emits warning notification when stream disconnects", async () => {
    triggerOanda(makeOandaData({ streamConnected: true }))
    triggerOanda(makeOandaData({ streamConnected: false }))

    await vi.waitFor(() => {
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: "warning",
          source: "oanda_stream",
          title: "Price Stream Lost",
        }),
      )
    })
  })

  it("emits info notification when stream restores", async () => {
    triggerOanda(makeOandaData({ streamConnected: false }))
    triggerOanda(makeOandaData({ streamConnected: true }))

    await vi.waitFor(() => {
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: "info",
          source: "oanda_stream",
          title: "Price Stream Restored",
        }),
      )
    })
  })

  it("emits both API and stream notifications independently", async () => {
    // Establish baseline
    triggerOanda(makeOandaData({ apiReachable: true, streamConnected: true }))
    // Both go down
    triggerOanda(makeOandaData({ apiReachable: false, streamConnected: false }))

    await vi.waitFor(() => {
      expect(createNotification).toHaveBeenCalledTimes(2)
    })
    expect(broadcastedMessages).toHaveLength(2)
  })

  it("does not emit when state hasn't changed", () => {
    triggerOanda(makeOandaData({ apiReachable: true, streamConnected: true }))
    triggerOanda(makeOandaData({ apiReachable: true, streamConnected: true }))

    expect(createNotification).not.toHaveBeenCalled()
  })

  it("broadcasts notification with correct message shape", async () => {
    triggerOanda(makeOandaData({ streamConnected: true }))
    triggerOanda(makeOandaData({ streamConnected: false }))

    await vi.waitFor(() => {
      expect(broadcastedMessages).toHaveLength(1)
    })

    const msg = broadcastedMessages[0]!
    expect(msg.type).toBe("notification_created")
    expect(msg.timestamp).toBeDefined()
    expect(msg.data).toMatchObject({
      id: expect.any(String),
      severity: "warning",
      source: "oanda_stream",
      title: "Price Stream Lost",
      dismissed: false,
    })
  })
})
