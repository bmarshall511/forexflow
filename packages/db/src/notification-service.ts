/**
 * Notification service — manages in-app notifications with deduplication.
 *
 * Handles creation (with 5-second dedup window), listing with pagination,
 * dismiss/delete operations, and cleanup of old notifications.
 *
 * @module notification-service
 */
import { db } from "./client"
import type {
  NotificationData,
  NotificationSeverity,
  NotificationSource,
  NotificationListResponse,
} from "@fxflow/types"

// ─── Input types ─────────────────────────────────────────────────────────────

/** Fields required to create a new notification. */
export interface CreateNotificationInput {
  severity: NotificationSeverity
  source: NotificationSource
  title: string
  message: string
  /** Optional JSON metadata for deep links */
  metadata?: Record<string, unknown>
}

/** Filtering and pagination options for listing notifications. */
export interface ListNotificationsOptions {
  dismissed?: boolean
  severity?: NotificationSeverity
  limit?: number
  offset?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a Prisma notification row to the `NotificationData` DTO.
 *
 * @param row - Raw notification row from Prisma
 * @returns Serialized notification data for the API/UI
 */
function toNotificationData(row: {
  id: string
  severity: string
  source: string
  title: string
  message: string
  metadata?: string | null
  dismissed: boolean
  createdAt: Date
}): NotificationData {
  return {
    id: row.id,
    severity: row.severity as NotificationSeverity,
    source: row.source as NotificationSource,
    title: row.title,
    message: row.message,
    metadata: row.metadata ?? null,
    dismissed: row.dismissed,
    createdAt: row.createdAt.toISOString(),
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a notification with 5-second deduplication. Returns null if a matching
 * notification (same source + title) was created within the last 5 seconds.
 *
 * @param input - Notification creation parameters
 * @returns The created notification data, or null if deduplicated
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<NotificationData | null> {
  // 5-second dedup: skip if matching source + title exists within last 5s
  const fiveSecondsAgo = new Date(Date.now() - 5000)
  const existing = await db.notification.findFirst({
    where: {
      source: input.source,
      title: input.title,
      createdAt: { gte: fiveSecondsAgo },
    },
  })
  if (existing) return null

  const row = await db.notification.create({
    data: {
      severity: input.severity,
      source: input.source,
      title: input.title,
      message: input.message,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  })
  return toNotificationData(row)
}

/**
 * List notifications with filtering and pagination. Also returns the total
 * undismissed count for badge display.
 *
 * @param opts - Filter and pagination options
 * @returns Paginated notification list with counts
 */
export async function listNotifications(
  opts: ListNotificationsOptions = {},
): Promise<NotificationListResponse> {
  const { dismissed, severity, limit = 50, offset = 0 } = opts

  const where: Record<string, unknown> = {}
  if (dismissed !== undefined) where.dismissed = dismissed
  if (severity) where.severity = severity

  const [notifications, totalCount, undismissedCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { dismissed: false } }),
  ])

  return {
    notifications: notifications.map(toNotificationData),
    totalCount,
    undismissedCount,
  }
}

/**
 * Mark a single notification as dismissed.
 *
 * @param id - Notification ID to dismiss
 * @returns The dismissed notification data, or null if not found
 */
export async function dismissNotification(id: string): Promise<NotificationData | null> {
  try {
    const row = await db.notification.update({
      where: { id },
      data: { dismissed: true },
    })
    return toNotificationData(row)
  } catch {
    return null
  }
}

/**
 * Dismiss all undismissed notifications at once.
 *
 * @returns Number of notifications dismissed
 */
export async function dismissAllNotifications(): Promise<number> {
  const result = await db.notification.updateMany({
    where: { dismissed: false },
    data: { dismissed: true },
  })
  return result.count
}

/**
 * Permanently delete a single notification.
 *
 * @param id - Notification ID to delete
 * @returns True if deleted, false if not found
 */
export async function deleteNotification(id: string): Promise<boolean> {
  try {
    await db.notification.delete({ where: { id } })
    return true
  } catch {
    return false
  }
}

/**
 * Delete all dismissed notifications.
 *
 * @returns Number of notifications deleted
 */
export async function deleteAllDismissed(): Promise<number> {
  const result = await db.notification.deleteMany({
    where: { dismissed: true },
  })
  return result.count
}

/**
 * Get the count of undismissed notifications (for badge display).
 *
 * @returns Number of undismissed notifications
 */
export async function getUndismissedCount(): Promise<number> {
  return db.notification.count({ where: { dismissed: false } })
}

/**
 * Delete notifications older than the specified number of days.
 *
 * @param days - Age threshold in days (default: 30)
 * @returns Number of notifications deleted
 */
export async function cleanupOldNotifications(days = 30): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const result = await db.notification.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
  return result.count
}
