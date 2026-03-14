"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  NotificationData,
  NotificationListResponse,
  NotificationSeverity,
  NotificationSource,
} from "@fxflow/types"

export interface UseNotificationsReturn {
  notifications: NotificationData[]
  undismissedCount: number
  isLoading: boolean
  dismiss: (id: string) => Promise<void>
  dismissAll: () => Promise<void>
  deleteOne: (id: string) => Promise<void>
  deleteAllDismissed: () => Promise<void>
  refresh: () => Promise<void>
  addFromWs: (notification: NotificationData) => void
  createClientNotification: (input: {
    severity: NotificationSeverity
    source: NotificationSource
    title: string
    message: string
  }) => Promise<void>
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [undismissedCount, setUndismissedCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const mountedRef = useRef(true)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) return
      const json = (await res.json()) as { ok: boolean; data: NotificationListResponse }
      if (json.ok && json.data && mountedRef.current) {
        setNotifications(json.data.notifications)
        setUndismissedCount(json.data.undismissedCount)
      }
    } catch {
      // API not available
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void fetchNotifications()
    return () => {
      mountedRef.current = false
    }
  }, [fetchNotifications])

  const dismiss = useCallback(
    async (id: string) => {
      // Optimistic update
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n)))
      setUndismissedCount((prev) => Math.max(0, prev - 1))

      try {
        await fetch(`/api/notifications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dismissed: true }),
        })
      } catch {
        // Revert on failure — refetch
        void fetchNotifications()
      }
    },
    [fetchNotifications],
  )

  const dismissAll = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, dismissed: true })))
    setUndismissedCount(0)

    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss_all" }),
      })
    } catch {
      void fetchNotifications()
    }
  }, [fetchNotifications])

  const deleteOne = useCallback(
    async (id: string) => {
      const target = notifications.find((n) => n.id === id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      if (target && !target.dismissed) {
        setUndismissedCount((prev) => Math.max(0, prev - 1))
      }

      try {
        await fetch(`/api/notifications/${id}`, { method: "DELETE" })
      } catch {
        void fetchNotifications()
      }
    },
    [notifications, fetchNotifications],
  )

  const deleteAllDismissed = useCallback(async () => {
    setNotifications((prev) => prev.filter((n) => !n.dismissed))

    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_dismissed" }),
      })
    } catch {
      void fetchNotifications()
    }
  }, [fetchNotifications])

  const addFromWs = useCallback((notification: NotificationData) => {
    setNotifications((prev) => {
      // Avoid duplicates
      if (prev.some((n) => n.id === notification.id)) return prev
      return [notification, ...prev]
    })
    if (!notification.dismissed) {
      setUndismissedCount((prev) => prev + 1)
    }
  }, [])

  const createClientNotification = useCallback(
    async (input: {
      severity: NotificationSeverity
      source: NotificationSource
      title: string
      message: string
    }) => {
      try {
        const res = await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", ...input }),
        })
        if (!res.ok) return
        const json = (await res.json()) as { ok: boolean; data: NotificationData | null }
        if (json.ok && json.data && mountedRef.current) {
          addFromWs(json.data)
        }
      } catch {
        // Ignore
      }
    },
    [addFromWs],
  )

  return {
    notifications,
    undismissedCount,
    isLoading,
    dismiss,
    dismissAll,
    deleteOne,
    deleteAllDismissed,
    refresh: fetchNotifications,
    addFromWs,
    createClientNotification,
  }
}
