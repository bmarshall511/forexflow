import type { Metadata } from "next"
import { TradeFinderDashboard } from "@/components/trade-finder/trade-finder-dashboard"

export const metadata: Metadata = { title: "Trade Finder" }

export default function TradeFinderPage() {
  return <TradeFinderDashboard />
}
