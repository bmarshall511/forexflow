import { AccountOverviewCard } from "@/components/dashboard/account-overview-card"
import { PositionsDashboardCard } from "@/components/dashboard/positions-card"
import { TVAlertsDashboardCard } from "@/components/dashboard/tv-alerts-card"
import { AiInsightsCard } from "@/components/dashboard/ai-insights-card"
import { DigestCard } from "@/components/ai/digest-card"

export default function DashboardPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Forex trading command center
      </p>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <AccountOverviewCard />
        <PositionsDashboardCard />
        <TVAlertsDashboardCard />
        <AiInsightsCard />
        <DigestCard />
      </div>
    </div>
  )
}
