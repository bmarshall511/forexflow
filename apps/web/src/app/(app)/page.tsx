import type { Metadata } from "next"
import { AccountOverviewCard } from "@/components/dashboard/account-overview-card"

export const metadata: Metadata = { title: "Dashboard" }
import { PositionsDashboardCard } from "@/components/dashboard/positions-card"
import { TVAlertsDashboardCard } from "@/components/dashboard/tv-alerts-card"
import { AiInsightsCard } from "@/components/dashboard/ai-insights-card"
import { AiTraderCard } from "@/components/dashboard/ai-trader-card"
import { DigestCard } from "@/components/ai/digest-card"

export default function DashboardPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground mt-1 text-sm">Forex trading command center</p>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <AccountOverviewCard />
        <PositionsDashboardCard />
        <TVAlertsDashboardCard />
        <AiInsightsCard />
        <AiTraderCard />
        <DigestCard />
      </div>
    </div>
  )
}
