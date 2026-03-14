import type { Metadata } from "next"
import { AiTraderDashboard } from "@/components/ai-trader/ai-trader-dashboard"

export const metadata: Metadata = { title: "AI Trader" }

export default function AiTraderPage() {
  return <AiTraderDashboard />
}
