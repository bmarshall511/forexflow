import { getSidebarCookieValue } from "@/lib/cookies"
import { getSettings, getOnboardingCompleted } from "@fxflow/db"
import { SidebarProvider } from "@/state/sidebar-context"
import { TradingModeProvider } from "@/state/trading-mode-context"
import { DaemonStatusProvider } from "@/state/daemon-status-context"
import { InternetStatusProvider } from "@/state/internet-status-context"
import { NotificationProvider } from "@/state/notification-context"
import { AppShell } from "@/components/layout/app-shell"
import { OnboardingGate } from "@/components/onboarding/onboarding-gate"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, initialSettings, onboardingCompleted] = await Promise.all([
    getSidebarCookieValue(),
    getSettings(),
    getOnboardingCompleted(),
  ])

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <TradingModeProvider initialSettings={initialSettings}>
        <DaemonStatusProvider>
          <InternetStatusProvider>
            <NotificationProvider>
              <OnboardingGate showOnboarding={!onboardingCompleted}>
                <AppShell>{children}</AppShell>
              </OnboardingGate>
            </NotificationProvider>
          </InternetStatusProvider>
        </DaemonStatusProvider>
      </TradingModeProvider>
    </SidebarProvider>
  )
}
