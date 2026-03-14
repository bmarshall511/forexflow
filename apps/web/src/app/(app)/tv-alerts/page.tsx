import type { Metadata } from "next"
import { TVAlertsDashboard } from "@/components/tv-alerts/tv-alerts-dashboard"

export const metadata: Metadata = { title: "TV Alerts" }

export default function TVAlertsPage() {
  return <TVAlertsDashboard />
}
