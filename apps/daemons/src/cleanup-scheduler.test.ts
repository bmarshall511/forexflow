import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { CleanupScheduler } from "./cleanup-scheduler"

// Mock @fxflow/shared
vi.mock("@fxflow/shared", () => ({
  toET: vi.fn(),
}))

// Mock @fxflow/db
vi.mock("@fxflow/db", () => ({
  cleanupOldNotifications: vi.fn().mockResolvedValue(5),
  cleanupOldAnalyses: vi.fn().mockResolvedValue(3),
  cleanupOldZones: vi.fn().mockResolvedValue(2),
  cleanupOldSignals: vi.fn().mockResolvedValue(7),
  cleanupOldAuditEvents: vi.fn().mockResolvedValue(1),
  cleanupExpiredData: vi.fn().mockResolvedValue(4),
  cleanupOldOpportunities: vi.fn().mockResolvedValue(0),
  cleanupOldTrends: vi.fn().mockResolvedValue(6),
  cleanupOldCurveSnapshots: vi.fn().mockResolvedValue(2),
  cleanupOldPerformance: vi.fn().mockResolvedValue(0),
  cleanupOldEvents: vi.fn().mockResolvedValue(8),
}))

import { toET } from "@fxflow/shared"
import {
  cleanupOldNotifications,
  cleanupOldAnalyses,
  cleanupOldZones,
  cleanupOldSignals,
  cleanupOldAuditEvents,
  cleanupExpiredData,
  cleanupOldOpportunities,
  cleanupOldTrends,
  cleanupOldCurveSnapshots,
  cleanupOldPerformance,
  cleanupOldEvents,
} from "@fxflow/db"

const mockedToET = vi.mocked(toET)

describe("CleanupScheduler", () => {
  let scheduler: CleanupScheduler

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    scheduler = new CleanupScheduler()
  })

  afterEach(() => {
    scheduler.stop()
    vi.useRealTimers()
  })

  function mockET(hour: number, day: number) {
    mockedToET.mockReturnValue({ hour, minute: 0, day })
  }

  describe("shouldRun logic", () => {
    it("runs cleanup immediately on start when conditions are met", async () => {
      mockET(5, 1) // 5 AM ET, Monday
      scheduler.start()

      // Flush microtasks for the async cleanup
      await Promise.resolve()
      await Promise.resolve()

      expect(cleanupOldNotifications).toHaveBeenCalledWith(30)
    })

    it("does not run on Saturday (day 6)", async () => {
      mockET(5, 6) // 5 AM ET, Saturday
      scheduler.start()

      await Promise.resolve()

      expect(cleanupOldNotifications).not.toHaveBeenCalled()
    })

    it("does not run outside the 5 AM hour", async () => {
      mockET(3, 1) // 3 AM ET, Monday
      scheduler.start()

      await Promise.resolve()

      expect(cleanupOldNotifications).not.toHaveBeenCalled()
    })

    it("does not run twice on the same calendar day", async () => {
      mockET(5, 2) // 5 AM ET, Tuesday
      scheduler.start()

      await Promise.resolve()
      await Promise.resolve()
      expect(cleanupOldNotifications).toHaveBeenCalledTimes(1)

      // Advance one hour, still 5 AM conditions on same date
      vi.clearAllMocks()
      mockET(5, 2)
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      expect(cleanupOldNotifications).not.toHaveBeenCalled()
    })

    it("runs on Sunday (day 0)", async () => {
      mockET(5, 0) // 5 AM ET, Sunday
      scheduler.start()

      await Promise.resolve()
      await Promise.resolve()

      expect(cleanupOldNotifications).toHaveBeenCalled()
    })
  })

  describe("hourly interval", () => {
    it("checks every hour after start", async () => {
      // Start at a time that doesn't trigger
      mockET(3, 1) // 3 AM ET, Monday
      scheduler.start()

      await Promise.resolve()
      expect(cleanupOldNotifications).not.toHaveBeenCalled()

      // Advance one hour — conditions now favorable
      mockET(5, 1)
      vi.advanceTimersByTime(60 * 60 * 1000)
      await Promise.resolve()
      await Promise.resolve()

      expect(cleanupOldNotifications).toHaveBeenCalled()
    })
  })

  describe("stop", () => {
    it("clears the interval so no further checks occur", async () => {
      mockET(3, 1) // Start outside the window
      scheduler.start()
      scheduler.stop()

      // Even if conditions become favorable, nothing fires
      mockET(5, 1)
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      expect(cleanupOldNotifications).not.toHaveBeenCalled()
    })

    it("is safe to call multiple times", () => {
      scheduler.start()
      scheduler.stop()
      scheduler.stop() // should not throw
    })
  })

  describe("start idempotency", () => {
    it("does not create duplicate intervals on multiple start calls", async () => {
      mockET(3, 1)
      scheduler.start()
      scheduler.start() // second call should be no-op

      // Only one interval should exist, so one hour advance = one check
      mockET(5, 1)
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      // Should only be called once, not twice (if duplicate intervals existed)
      expect(cleanupOldNotifications).toHaveBeenCalledTimes(1)
    })
  })

  describe("runCleanup", () => {
    it("calls all cleanup functions with correct retention days", async () => {
      await scheduler.runCleanup()

      expect(cleanupOldNotifications).toHaveBeenCalledWith(30)
      expect(cleanupOldAnalyses).toHaveBeenCalledWith(90)
      expect(cleanupOldZones).toHaveBeenCalledWith(30)
      expect(cleanupOldSignals).toHaveBeenCalledWith(30)
      expect(cleanupOldAuditEvents).toHaveBeenCalledWith(30)
      expect(cleanupExpiredData).toHaveBeenCalledWith()
      expect(cleanupOldOpportunities).toHaveBeenCalledWith(60)
      expect(cleanupOldTrends).toHaveBeenCalledWith(30)
      expect(cleanupOldCurveSnapshots).toHaveBeenCalledWith(30)
      expect(cleanupOldPerformance).toHaveBeenCalledWith(180)
      expect(cleanupOldEvents).toHaveBeenCalledWith(30)
    })

    it("continues executing remaining tasks when one fails", async () => {
      vi.mocked(cleanupOldNotifications).mockRejectedValueOnce(new Error("DB locked"))

      await scheduler.runCleanup()

      // Subsequent tasks should still run
      expect(cleanupOldAnalyses).toHaveBeenCalled()
      expect(cleanupOldZones).toHaveBeenCalled()
      expect(cleanupOldEvents).toHaveBeenCalled()
    })

    it("logs errors without throwing", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      vi.mocked(cleanupOldAnalyses).mockRejectedValueOnce(new Error("Disk full"))

      // Should not throw
      await scheduler.runCleanup()

      expect(consoleSpy).toHaveBeenCalledWith(
        "[cleanup-scheduler] ai-analyses failed:",
        "Disk full",
      )
    })
  })
})
