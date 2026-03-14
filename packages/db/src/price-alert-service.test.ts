import { describe, it, expect, vi, beforeEach } from "vitest"

const mockPriceAlert = vi.hoisted(() => ({
  create: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
}))

vi.mock("./client", () => ({
  db: {
    priceAlert: mockPriceAlert,
  },
}))

import {
  createPriceAlert,
  listPriceAlerts,
  getPriceAlert,
  updatePriceAlert,
  deletePriceAlert,
  triggerPriceAlert,
  getActiveAlertsForInstrument,
  getActiveAlertInstruments,
  expireOldAlerts,
  cancelAllAlerts,
} from "./price-alert-service"

const sampleRow = {
  id: "alert-1",
  instrument: "EUR_USD",
  direction: "above",
  targetPrice: 1.105,
  currentPrice: 1.1,
  label: "Breakout level",
  status: "active",
  repeating: false,
  triggeredAt: null,
  expiresAt: null,
  createdAt: new Date("2025-06-01T10:00:00Z"),
}

describe("price-alert-service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("createPriceAlert", () => {
    it("creates an alert and returns serialized DTO", async () => {
      mockPriceAlert.create.mockResolvedValue(sampleRow)

      const result = await createPriceAlert({
        instrument: "EUR_USD",
        direction: "above",
        targetPrice: 1.105,
        currentPrice: 1.1,
        label: "Breakout level",
      })

      expect(result.id).toBe("alert-1")
      expect(result.instrument).toBe("EUR_USD")
      expect(result.direction).toBe("above")
      expect(result.targetPrice).toBe(1.105)
      expect(result.createdAt).toBe("2025-06-01T10:00:00.000Z")
      expect(result.triggeredAt).toBeNull()
      expect(mockPriceAlert.create).toHaveBeenCalledWith({
        data: {
          instrument: "EUR_USD",
          direction: "above",
          targetPrice: 1.105,
          currentPrice: 1.1,
          label: "Breakout level",
          repeating: false,
          expiresAt: null,
        },
      })
    })

    it("defaults label to null and repeating to false", async () => {
      mockPriceAlert.create.mockResolvedValue({ ...sampleRow, label: null })

      await createPriceAlert({
        instrument: "EUR_USD",
        direction: "above",
        targetPrice: 1.105,
        currentPrice: 1.1,
      })

      expect(mockPriceAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          label: null,
          repeating: false,
          expiresAt: null,
        }),
      })
    })
  })

  describe("listPriceAlerts", () => {
    it("returns all alerts when no filters given", async () => {
      mockPriceAlert.findMany.mockResolvedValue([sampleRow])

      const result = await listPriceAlerts()

      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe("alert-1")
      expect(mockPriceAlert.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: "desc" },
      })
    })

    it("passes status and instrument filters", async () => {
      mockPriceAlert.findMany.mockResolvedValue([])

      await listPriceAlerts({ status: "active", instrument: "GBP_USD" })

      expect(mockPriceAlert.findMany).toHaveBeenCalledWith({
        where: { status: "active", instrument: "GBP_USD" },
        orderBy: { createdAt: "desc" },
      })
    })
  })

  describe("getPriceAlert", () => {
    it("returns alert data when found", async () => {
      mockPriceAlert.findUnique.mockResolvedValue(sampleRow)

      const result = await getPriceAlert("alert-1")

      expect(result).not.toBeNull()
      expect(result!.id).toBe("alert-1")
      expect(mockPriceAlert.findUnique).toHaveBeenCalledWith({ where: { id: "alert-1" } })
    })

    it("returns null when not found", async () => {
      mockPriceAlert.findUnique.mockResolvedValue(null)

      const result = await getPriceAlert("nonexistent")
      expect(result).toBeNull()
    })
  })

  describe("updatePriceAlert", () => {
    it("updates fields and returns serialized result", async () => {
      mockPriceAlert.update.mockResolvedValue({ ...sampleRow, label: "Updated" })

      const result = await updatePriceAlert("alert-1", { label: "Updated" })

      expect(result.label).toBe("Updated")
      expect(mockPriceAlert.update).toHaveBeenCalledWith({
        where: { id: "alert-1" },
        data: { label: "Updated" },
      })
    })
  })

  describe("deletePriceAlert", () => {
    it("deletes the alert by ID", async () => {
      mockPriceAlert.delete.mockResolvedValue(sampleRow)

      await deletePriceAlert("alert-1")

      expect(mockPriceAlert.delete).toHaveBeenCalledWith({ where: { id: "alert-1" } })
    })
  })

  describe("triggerPriceAlert", () => {
    it("sets status to triggered for non-repeating alert", async () => {
      mockPriceAlert.findUniqueOrThrow.mockResolvedValue({ ...sampleRow, repeating: false })
      const triggeredAt = new Date()
      mockPriceAlert.update.mockResolvedValue({
        ...sampleRow,
        status: "triggered",
        triggeredAt,
      })

      const result = await triggerPriceAlert("alert-1")

      expect(result.status).toBe("triggered")
      expect(mockPriceAlert.update).toHaveBeenCalledWith({
        where: { id: "alert-1" },
        data: { status: "triggered", triggeredAt: expect.any(Date) },
      })
    })

    it("resets status to active for repeating alert", async () => {
      mockPriceAlert.findUniqueOrThrow.mockResolvedValue({ ...sampleRow, repeating: true })
      mockPriceAlert.update.mockResolvedValue({
        ...sampleRow,
        repeating: true,
        status: "active",
        triggeredAt: new Date(),
      })

      const result = await triggerPriceAlert("alert-1")

      expect(result.status).toBe("active")
      expect(mockPriceAlert.update).toHaveBeenCalledWith({
        where: { id: "alert-1" },
        data: { status: "active", triggeredAt: expect.any(Date) },
      })
    })
  })

  describe("getActiveAlertsForInstrument", () => {
    it("queries active alerts for instrument sorted by price", async () => {
      mockPriceAlert.findMany.mockResolvedValue([sampleRow])

      const result = await getActiveAlertsForInstrument("EUR_USD")

      expect(result).toHaveLength(1)
      expect(mockPriceAlert.findMany).toHaveBeenCalledWith({
        where: { instrument: "EUR_USD", status: "active" },
        orderBy: { targetPrice: "asc" },
      })
    })
  })

  describe("getActiveAlertInstruments", () => {
    it("returns distinct instruments with active alerts", async () => {
      mockPriceAlert.findMany.mockResolvedValue([
        { instrument: "EUR_USD" },
        { instrument: "GBP_USD" },
      ])

      const result = await getActiveAlertInstruments()

      expect(result).toEqual(["EUR_USD", "GBP_USD"])
      expect(mockPriceAlert.findMany).toHaveBeenCalledWith({
        where: { status: "active" },
        select: { instrument: true },
        distinct: ["instrument"],
      })
    })
  })

  describe("expireOldAlerts", () => {
    it("expires active alerts past their expiresAt date", async () => {
      mockPriceAlert.updateMany.mockResolvedValue({ count: 2 })

      const count = await expireOldAlerts()

      expect(count).toBe(2)
      expect(mockPriceAlert.updateMany).toHaveBeenCalledWith({
        where: { status: "active", expiresAt: { lte: expect.any(Date) } },
        data: { status: "expired" },
      })
    })
  })

  describe("cancelAllAlerts", () => {
    it("cancels all active alerts", async () => {
      mockPriceAlert.updateMany.mockResolvedValue({ count: 5 })

      const count = await cancelAllAlerts()

      expect(count).toBe(5)
      expect(mockPriceAlert.updateMany).toHaveBeenCalledWith({
        where: { status: "active" },
        data: { status: "cancelled" },
      })
    })
  })
})
