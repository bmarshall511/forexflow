import { getSidebarCookieValue } from "@/lib/cookies"
import { getSettings } from "@fxflow/db"
import { SidebarProvider } from "@/state/sidebar-context"
import { TradingModeProvider } from "@/state/trading-mode-context"
import { DaemonStatusProvider } from "@/state/daemon-status-context"
import { InternetStatusProvider } from "@/state/internet-status-context"
import { NotificationProvider } from "@/state/notification-context"
import { AppShell } from "@/components/layout/app-shell"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, initialSettings] = await Promise.all([getSidebarCookieValue(), getSettings()])

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <TradingModeProvider initialSettings={initialSettings}>
        <DaemonStatusProvider>
          <InternetStatusProvider>
            <NotificationProvider>
              <AppShell>{children}</AppShell>
            </NotificationProvider>
          </InternetStatusProvider>
        </DaemonStatusProvider>
      </TradingModeProvider>
    </SidebarProvider>
  )
}
