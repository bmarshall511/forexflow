"use client"

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react"
import { useNotifications, type UseNotificationsReturn } from "@/hooks/use-notifications"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { useInternetStatus } from "@/hooks/use-internet-status-context"
import { playSound } from "@/lib/sounds"

const NotificationContext = createContext<UseNotificationsReturn | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const notifications = useNotifications()
  const { isConnected, lastNotification } = useDaemonStatus()
  const { isOnline } = useInternetStatus()

  // Track previous states for transition detection
  const prevConnectedRef = useRef<boolean | null>(null)
  const prevOnlineRef = useRef<boolean | null>(null)

  // Handle real-time notifications from daemon WS
  useEffect(() => {
    if (lastNotification) {
      notifications.addFromWs(lastNotification)

      // Play sound based on notification type
      const isFillNotification =
        lastNotification.title.toLowerCase().includes("filled") ||
        lastNotification.title.toLowerCase().includes("order fill")
      if (isFillNotification) {
        playSound("trade_fill")
      } else if (lastNotification.severity === "critical") {
        playSound("alert_trigger")
      } else {
        playSound("notification")
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastNotification])

  // Detect daemon WS connection changes (client-side)
  useEffect(() => {
    if (prevConnectedRef.current !== null && prevConnectedRef.current !== isConnected) {
      if (!isConnected) {
        void notifications.createClientNotification({
          severity: "warning",
          source: "daemon",
          title: "Daemon Disconnected",
          message: "Lost connection to the daemon service. Attempting to reconnect.",
        })
      } else {
        void notifications.createClientNotification({
          severity: "info",
          source: "daemon",
          title: "Daemon Connected",
          message: "Connection to the daemon service has been restored.",
        })
      }
    }
    prevConnectedRef.current = isConnected
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected])

  // Detect internet connectivity changes (from InternetStatusProvider)
  useEffect(() => {
    if (prevOnlineRef.current !== null && prevOnlineRef.current !== isOnline) {
      if (!isOnline) {
        void notifications.createClientNotification({
          severity: "critical",
          source: "internet",
          title: "Internet Disconnected",
          message: "Your device has lost internet connectivity.",
        })
      } else {
        void notifications.createClientNotification({
          severity: "info",
          source: "internet",
          title: "Internet Restored",
          message: "Your internet connection has been restored.",
        })
      }
    }
    prevOnlineRef.current = isOnline
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  return (
    <NotificationContext.Provider value={notifications}>{children}</NotificationContext.Provider>
  )
}

export function useNotificationContext(): UseNotificationsReturn {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error("useNotificationContext must be used within a NotificationProvider")
  }
  return context
}
