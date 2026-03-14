"use client"

import { useRiskDashboard } from "@/hooks/use-risk-dashboard"
import { PageHeader } from "@/components/ui/page-header"
import { Shield } from "lucide-react"
import { PortfolioHeatGauge } from "./portfolio-heat-gauge"
import { CorrelationMatrix } from "./correlation-matrix"
import { DrawdownTracker } from "./drawdown-tracker"
import { PositionSizer } from "./position-sizer"
import { RiskPerTradeChart } from "./risk-per-trade-chart"

export function RiskDashboard() {
  const {
    portfolioHeat,
    tradeRisks,
    correlationEntries,
    drawdown,
    drawdownLoading,
    accountBalance,
    accountCurrency,
    openTrades,
  } = useRiskDashboard()

  const instruments = [...new Set(openTrades.map((t) => t.instrument))]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Management"
        subtitle="Monitor portfolio risk, correlations, and size positions"
        icon={Shield}
      />

      {/* Card grid */}
      <div className="grid gap-4 px-4 pb-6 md:grid-cols-2 md:px-6 lg:grid-cols-3">
        {/* Portfolio Heat — spans 1 col on lg, 1 col on md */}
        <div className="lg:row-span-1">
          <PortfolioHeatGauge
            heat={portfolioHeat}
            tradeRisks={tradeRisks}
            currency={accountCurrency}
          />
        </div>

        {/* Correlation Matrix */}
        <div className="lg:row-span-1">
          <CorrelationMatrix entries={correlationEntries} instruments={instruments} />
        </div>

        {/* Drawdown Tracker */}
        <div className="lg:row-span-1">
          <DrawdownTracker
            drawdown={drawdown}
            loading={drawdownLoading}
            currency={accountCurrency}
          />
        </div>

        {/* Position Sizer */}
        <div className="md:col-span-1">
          <PositionSizer accountBalance={accountBalance} currency={accountCurrency} />
        </div>

        {/* Risk Per Trade Chart — wider */}
        <div className="md:col-span-1 lg:col-span-2">
          <RiskPerTradeChart targetRisk={1} />
        </div>
      </div>
    </div>
  )
}
