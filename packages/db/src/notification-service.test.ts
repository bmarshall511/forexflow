import { describe, it, expect, vi, beforeEach } from "vitest"

// vi.hoisted ensures the mock object is available when vi.mock factory runs
const mockNotification = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
}))

vi.mock("./client", () => ({
  db: {
    notification: mockNotification,
  },
}))

import {
  createNotification,
  listNotifications,
  dismissNotification,
  dismissAllNotifications,
  deleteNotification,
  deleteAllDismissed,
  getUndismissedCount,
  cleanupOldNotifications,
} from "./notification-service"

const sampleRow = {
  id: "abc-123",
  severity: "warning",
  source: "oanda_stream",
  title: "Price Stream Lost",
  message: "The stream disconnected.",
  dismissed: false,
  createdAt: new Date("2025-01-15T12:00:00Z"),
}

describe("notification-service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("createNotification", () => {
    it("creates a notification and returns it", async () => {
      mockNotification.findFirst.mockResolvedValue(null) // no dedup match
      mockNotification.create.mockResolvedValue(sampleRow)

      const result = await createNotification({
        severity: "warning",
        source: "oanda_stream",
        title: "Price Stream Lost",
        message: "The stream disconnected.",
      })

      expect(result).not.toBeNull()
      expect(result!.id).toBe("abc-123")
      expect(result!.severity).toBe("warning")
      expect(result!.source).toBe("oanda_stream")
      expect(result!.createdAt).toBe("2025-01-15T12:00:00.000Z")
      expect(mockNotification.create).toHaveBeenCalledOnce()
    })

    it("returns null when dedup finds a recent matching notification", async () => {
      mockNotification.findFirst.mockResolvedValue(sampleRow) // dedup match

      const result = await createNotification({
        severity: "warning",
        source: "oanda_stream",
        title: "Price Stream Lost",
        message: "The stream disconnected.",
      })

      expect(result).toBeNull()
      expect(mockNotification.create).not.toHaveBeenCalled()
    })
  })

  describe("listNotifications", () => {
    it("returns paginated results with counts", async () => {
      mockNotification.findMany.mockResolvedValue([sampleRow])
      mockNotification.count
        .mockResolvedValueOnce(1) // totalCount
        .mockResolvedValueOnce(1) // undismissedCount

      const result = await listNotifications({ limit: 10 })

      expect(result.notifications).toHaveLength(1)
      expect(result.totalCount).toBe(1)
      expect(result.undismissedCount).toBe(1)
    })

    it("passes filter parameters correctly", async () => {
      mockNotification.findMany.mockResolvedValue([])
      mockNotification.count.mockResolvedValue(0)

      await listNotifications({ dismissed: false, severity: "critical", limit: 25, offset: 10 })

      expect(mockNotification.findMany).toHaveBeenCalledWith({
        where: { dismissed: false, severity: "critical" },
        orderBy: { createdAt: "desc" },
        take: 25,
        skip: 10,
      })
    })
  })

  describe("dismissNotification", () => {
    it("sets dismissed to true and returns updated notification", async () => {
      mockNotification.update.mockResolvedValue({ ...sampleRow, dismissed: true })

      const result = await dismissNotification("abc-123")

      expect(result).not.toBeNull()
      expect(result!.dismissed).toBe(true)
      expect(mockNotification.update).toHaveBeenCalledWith({
        where: { id: "abc-123" },
        data: { dismissed: true },
      })
    })

    it("returns null when notification not found", async () => {
      mockNotification.update.mockRejectedValue(new Error("Not found"))

      const result = await dismissNotification("nonexistent")
      expect(result).toBeNull()
    })
  })

  describe("dismissAllNotifications", () => {
    it("bulk dismisses all undismissed", async () => {
      mockNotification.updateMany.mockResolvedValue({ count: 5 })

      const count = await dismissAllNotifications()

      expect(count).toBe(5)
      expect(mockNotification.updateMany).toHaveBeenCalledWith({
        where: { dismissed: false },
        data: { dismissed: true },
      })
    })
  })

  describe("deleteNotification", () => {
    it("deletes a notification and returns true", async () => {
      mockNotification.delete.mockResolvedValue(sampleRow)

      const result = await deleteNotification("abc-123")
      expect(result).toBe(true)
    })

    it("returns false when notification not found", async () => {
      mockNotification.delete.mockRejectedValue(new Error("Not found"))

      const result = await deleteNotification("nonexistent")
      expect(result).toBe(false)
    })
  })

  describe("deleteAllDismissed", () => {
    it("deletes all dismissed notifications", async () => {
      mockNotification.deleteMany.mockResolvedValue({ count: 3 })

      const count = await deleteAllDismissed()

      expect(count).toBe(3)
      expect(mockNotification.deleteMany).toHaveBeenCalledWith({
        where: { dismissed: true },
      })
    })
  })

  describe("getUndismissedCount", () => {
    it("returns count of undismissed notifications", async () => {
      mockNotification.count.mockResolvedValue(7)

      const count = await getUndismissedCount()
      expect(count).toBe(7)
      expect(mockNotification.count).toHaveBeenCalledWith({
        where: { dismissed: false },
      })
    })
  })

  describe("cleanupOldNotifications", () => {
    it("deletes notifications older than specified days", async () => {
      mockNotification.deleteMany.mockResolvedValue({ count: 10 })

      const count = await cleanupOldNotifications(30)

      expect(count).toBe(10)
      expect(mockNotification.deleteMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: expect.any(Date) } },
      })
    })
  })
})
