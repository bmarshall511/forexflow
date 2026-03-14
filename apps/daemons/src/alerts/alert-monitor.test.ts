import { describe, it, expect, vi, beforeEach } from "vitest"
import { AlertMonitor } from "./alert-monitor"
import type { PriceAlertData, AnyDaemonMessage } from "@fxflow/types"

// Mock @fxflow/db
vi.mock("@fxflow/db", () => ({
  getActiveAlertInstruments: vi.fn().mockResolvedValue([]),
  getActiveAlertsForInstrument: vi.fn().mockResolvedValue([]),
  triggerPriceAlert: vi
    .fn()
    .mockImplementation((id: string) =>
      Promise.resolve(
        makeAlert({ id, status: "triggered", triggeredAt: new Date().toISOString() }),
      ),
    ),
  expireOldAlerts: vi.fn().mockResolvedValue(0),
}))

import {
  getActiveAlertInstruments,
  getActiveAlertsForInstrument,
  triggerPriceAlert,
  expireOldAlerts,
} from "@fxflow/db"

function makeAlert(overrides: Partial<PriceAlertData> = {}): PriceAlertData {
  return {
    id: "alert-1",
    instrument: "EUR_USD",
    direction: "above",
    targetPrice: 1.1,
    currentPrice: 1.09,
    label: null,
    status: "active",
    repeating: false,
    triggeredAt: null,
    expiresAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("AlertMonitor", () => {
  let monitor: AlertMonitor
  let broadcastedMessages: AnyDaemonMessage[]
  let emittedNotifications: Array<{ title: string; message: string; severity: string }>

  beforeEach(() => {
    vi.clearAllMocks()
    broadcastedMessages = []
    emittedNotifications = []

    monitor = new AlertMonitor(
      (msg) => broadcastedMessages.push(msg),
      (title, message, severity) => emittedNotifications.push({ title, message, severity }),
    )
  })

  describe("initialize and reload", () => {
    it("loads alerts from DB grouped by instrument", async () => {
      vi.mocked(getActiveAlertInstruments).mockResolvedValueOnce(["EUR_USD", "GBP_USD"])
      vi.mocked(getActiveAlertsForInstrument)
        .mockResolvedValueOnce([makeAlert({ instrument: "EUR_USD" })])
        .mockResolvedValueOnce([makeAlert({ id: "alert-2", instrument: "GBP_USD" })])

      await monitor.initialize()

      expect(monitor.getMonitoredInstruments()).toEqual(
        expect.arrayContaining(["EUR_USD", "GBP_USD"]),
      )
      monitor.stop()
    })

    it("returns empty instruments when no active alerts", async () => {
      await monitor.initialize()

      expect(monitor.getMonitoredInstruments()).toEqual([])
      monitor.stop()
    })
  })

  describe("onPriceTick — direction: above", () => {
    it("triggers alert when mid price reaches target (above)", async () => {
      const alert = makeAlert({ direction: "above", targetPrice: 1.1 })
      await monitor.onAlertCreated(alert)

      // mid = (1.0999 + 1.1001) / 2 = 1.1 — exactly at target
      monitor.onPriceTick("EUR_USD", 1.0999, 1.1001)

      await vi.waitFor(() => {
        expect(triggerPriceAlert).toHaveBeenCalledWith("alert-1")
      })
    })

    it("triggers alert when mid price exceeds target (above)", async () => {
      const alert = makeAlert({ direction: "above", targetPrice: 1.1 })
      await monitor.onAlertCreated(alert)

      // mid = (1.101 + 1.102) / 2 = 1.1015
      monitor.onPriceTick("EUR_USD", 1.101, 1.102)

      await vi.waitFor(() => {
        expect(triggerPriceAlert).toHaveBeenCalledWith("alert-1")
      })
    })

    it("does not trigger when mid price is below target (above)", () => {
      const alert = makeAlert({ direction: "above", targetPrice: 1.1 })
      monitor.onAlertCreated(alert)

      // mid = (1.0980 + 1.0982) / 2 = 1.0981
      monitor.onPriceTick("EUR_USD", 1.098, 1.0982)

      expect(triggerPriceAlert).not.toHaveBeenCalled()
    })
  })

  describe("onPriceTick — direction: below", () => {
    it("triggers alert when mid price reaches target (below)", async () => {
      const alert = makeAlert({ direction: "below", targetPrice: 1.08 })
      await monitor.onAlertCreated(alert)

      // mid = (1.0799 + 1.0801) / 2 = 1.08
      monitor.onPriceTick("EUR_USD", 1.0799, 1.0801)

      await vi.waitFor(() => {
        expect(triggerPriceAlert).toHaveBeenCalledWith("alert-1")
      })
    })

    it("triggers alert when mid price is under target (below)", async () => {
      const alert = makeAlert({ direction: "below", targetPrice: 1.08 })
      await monitor.onAlertCreated(alert)

      // mid = (1.07 + 1.0702) / 2 = 1.0701
      monitor.onPriceTick("EUR_USD", 1.07, 1.0702)

      await vi.waitFor(() => {
        expect(triggerPriceAlert).toHaveBeenCalledWith("alert-1")
      })
    })

    it("does not trigger when mid price is above target (below)", () => {
      const alert = makeAlert({ direction: "below", targetPrice: 1.08 })
      monitor.onAlertCreated(alert)

      // mid = (1.085 + 1.086) / 2 = 1.0855
      monitor.onPriceTick("EUR_USD", 1.085, 1.086)

      expect(triggerPriceAlert).not.toHaveBeenCalled()
    })
  })

  describe("trigger behavior", () => {
    it("broadcasts a price_alert_triggered WS message", async () => {
      const alert = makeAlert({ direction: "above", targetPrice: 1.1 })
      await monitor.onAlertCreated(alert)

      monitor.onPriceTick("EUR_USD", 1.101, 1.102)

      await vi.waitFor(() => {
        expect(broadcastedMessages).toHaveLength(1)
      })
      expect(broadcastedMessages[0]!.type).toBe("price_alert_triggered")
    })

    it("emits a notification with pair and direction info", async () => {
      const alert = makeAlert({
        direction: "above",
        targetPrice: 1.1,
        label: "Resistance",
      })
      await monitor.onAlertCreated(alert)

      monitor.onPriceTick("EUR_USD", 1.101, 1.102)

      await vi.waitFor(() => {
        expect(emittedNotifications).toHaveLength(1)
      })
      expect(emittedNotifications[0]!.title).toBe("Price Alert Triggered")
      expect(emittedNotifications[0]!.message).toContain("EUR/USD")
      expect(emittedNotifications[0]!.message).toContain('"Resistance"')
      expect(emittedNotifications[0]!.message).toContain("above")
      expect(emittedNotifications[0]!.severity).toBe("info")
    })

    it("removes non-repeating alert from memory after trigger", async () => {
      const alert = makeAlert({
        direction: "above",
        targetPrice: 1.1,
        repeating: false,
      })
      await monitor.onAlertCreated(alert)

      monitor.onPriceTick("EUR_USD", 1.101, 1.102)

      await vi.waitFor(() => {
        expect(triggerPriceAlert).toHaveBeenCalled()
      })

      // After trigger, the alert should be removed — no instruments monitored
      // Need a tick for the async removal to complete
      await vi.waitFor(() => {
        expect(monitor.getMonitoredInstruments()).toEqual([])
      })
    })

    it("keeps repeating alert in memory after trigger", async () => {
      const alert = makeAlert({
        direction: "above",
        targetPrice: 1.1,
        repeating: true,
      })
      await monitor.onAlertCreated(alert)

      monitor.onPriceTick("EUR_USD", 1.101, 1.102)

      await vi.waitFor(() => {
        expect(triggerPriceAlert).toHaveBeenCalled()
      })

      // Repeating alert should still be monitored
      expect(monitor.getMonitoredInstruments()).toContain("EUR_USD")
    })
  })

  describe("onAlertCreated", () => {
    it("adds an active alert to the in-memory index", async () => {
      const alert = makeAlert({ instrument: "GBP_USD" })
      await monitor.onAlertCreated(alert)

      expect(monitor.getMonitoredInstruments()).toContain("GBP_USD")
    })

    it("ignores non-active alerts", async () => {
      const alert = makeAlert({ status: "cancelled" })
      await monitor.onAlertCreated(alert)

      expect(monitor.getMonitoredInstruments()).toEqual([])
    })

    it("groups multiple alerts for the same instrument", async () => {
      await monitor.onAlertCreated(makeAlert({ id: "a1", instrument: "EUR_USD" }))
      await monitor.onAlertCreated(makeAlert({ id: "a2", instrument: "EUR_USD" }))

      expect(monitor.getMonitoredInstruments()).toEqual(["EUR_USD"])
    })
  })

  describe("onAlertDeleted", () => {
    it("removes a specific alert from memory", async () => {
      await monitor.onAlertCreated(makeAlert({ id: "a1", instrument: "EUR_USD" }))
      await monitor.onAlertCreated(makeAlert({ id: "a2", instrument: "EUR_USD" }))

      await monitor.onAlertDeleted("a1", "EUR_USD")

      // Instrument still monitored (a2 remains)
      expect(monitor.getMonitoredInstruments()).toContain("EUR_USD")
    })

    it("removes instrument key when last alert is deleted", async () => {
      await monitor.onAlertCreated(makeAlert({ id: "a1", instrument: "EUR_USD" }))

      await monitor.onAlertDeleted("a1", "EUR_USD")

      expect(monitor.getMonitoredInstruments()).toEqual([])
    })

    it("is a no-op for unknown instrument", async () => {
      await monitor.onAlertDeleted("a1", "GBP_USD")

      expect(monitor.getMonitoredInstruments()).toEqual([])
    })
  })

  describe("no alerts for instrument", () => {
    it("does nothing when receiving ticks for unmonitored instruments", () => {
      monitor.onPriceTick("USD_JPY", 110.5, 110.6)

      expect(triggerPriceAlert).not.toHaveBeenCalled()
      expect(broadcastedMessages).toHaveLength(0)
    })
  })

  describe("expiry", () => {
    it("reloads alerts when expiry finds expired alerts", async () => {
      vi.useFakeTimers()
      vi.mocked(expireOldAlerts).mockResolvedValueOnce(3)
      vi.mocked(getActiveAlertInstruments).mockResolvedValue([])

      await monitor.initialize()

      // Advance past expiry interval (60s)
      vi.advanceTimersByTime(60_000)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()

      expect(expireOldAlerts).toHaveBeenCalled()
      // reload should be called since count > 0
      // getActiveAlertInstruments called once in initialize + once in reload after expiry
      expect(getActiveAlertInstruments).toHaveBeenCalledTimes(2)

      monitor.stop()
      vi.useRealTimers()
    })
  })

  describe("multiple alerts trigger independently", () => {
    it("triggers all matching alerts on the same instrument", async () => {
      const alert1 = makeAlert({ id: "a1", direction: "above", targetPrice: 1.1 })
      const alert2 = makeAlert({ id: "a2", direction: "above", targetPrice: 1.09 })
      await monitor.onAlertCreated(alert1)
      await monitor.onAlertCreated(alert2)

      // mid = 1.1015 — both targets exceeded
      monitor.onPriceTick("EUR_USD", 1.101, 1.102)

      await vi.waitFor(() => {
        expect(triggerPriceAlert).toHaveBeenCalledTimes(2)
      })
      expect(triggerPriceAlert).toHaveBeenCalledWith("a1")
      expect(triggerPriceAlert).toHaveBeenCalledWith("a2")
    })
  })
})
