import type { Metadata } from "next"
import { TVAlertsSettings } from "@/components/settings/tv-alerts-settings"

export const metadata: Metadata = { title: "TV Alerts Settings" }

export default function TVAlertsSettingsPage() {
  return <TVAlertsSettings />
}
