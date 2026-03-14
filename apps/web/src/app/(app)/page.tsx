import type { Metadata } from "next"
import { AccountOverviewCard } from "@/components/dashboard/account-overview-card"

export const metadata: Metadata = { title: "Dashboard" }
import { PositionsDashboardCard } from "@/components/dashboard/positions-card"
import { TVAlertsDashboardCard } from "@/components/dashboard/tv-alerts-card"
import { AiInsightsCard } from "@/components/dashboard/ai-insights-card"
import { AiTraderCard } from "@/components/dashboard/ai-trader-card"
import { DigestCard } from "@/components/ai/digest-card"
import { CalendarCard } from "@/components/dashboard/calendar-card"
import { EquityCurveCard } from "@/components/dashboard/equity-curve-card"
import { CardErrorBoundary } from "@/components/ui/card-error-boundary"
import { PageHeader } from "@/components/ui/page-header"
import { LayoutDashboard } from "lucide-react"

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Forex trading command center"
        icon={LayoutDashboard}
      />
      <div className="grid grid-cols-1 gap-6 px-4 pb-6 md:px-6 xl:grid-cols-2 xl:items-start">
        <CardErrorBoundary>
          <AccountOverviewCard />
        </CardErrorBoundary>
        <CardErrorBoundary>
          <PositionsDashboardCard />
        </CardErrorBoundary>
        <CardErrorBoundary>
          <TVAlertsDashboardCard />
        </CardErrorBoundary>
        <CardErrorBoundary>
          <AiInsightsCard />
        </CardErrorBoundary>
        <CardErrorBoundary>
          <AiTraderCard />
        </CardErrorBoundary>
        <CardErrorBoundary>
          <DigestCard />
        </CardErrorBoundary>
        <CardErrorBoundary>
          <CalendarCard />
        </CardErrorBoundary>
        <CardErrorBoundary>
          <EquityCurveCard />
        </CardErrorBoundary>
      </div>
    </div>
  )
}
