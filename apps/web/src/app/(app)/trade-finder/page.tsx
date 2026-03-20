import type { Metadata } from "next"
import { Suspense } from "react"
import { TradeFinderDashboard } from "@/components/trade-finder/trade-finder-dashboard"

export const metadata: Metadata = { title: "Trade Finder" }

export default function TradeFinderPage() {
  return (
    <Suspense>
      <TradeFinderDashboard />
    </Suspense>
  )
}
