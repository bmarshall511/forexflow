import type { Metadata } from "next"
import { TVAlertsSettingsPage } from "@/components/settings/tva-settings-page"

export const metadata: Metadata = { title: "TV Alerts Settings" }

export default function Page() {
  return <TVAlertsSettingsPage />
}
