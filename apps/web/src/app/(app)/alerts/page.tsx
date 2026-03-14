import type { Metadata } from "next"
import { AlertsDashboard } from "@/components/alerts/alerts-dashboard"

export const metadata: Metadata = { title: "Price Alerts" }

export default function AlertsPage() {
  return <AlertsDashboard />
}
