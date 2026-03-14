import type { Metadata } from "next"
import { RiskDashboard } from "@/components/risk/risk-dashboard"

export const metadata: Metadata = { title: "Risk Management" }

export default function RiskPage() {
  return <RiskDashboard />
}
