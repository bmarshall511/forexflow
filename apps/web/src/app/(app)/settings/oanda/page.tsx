import type { Metadata } from "next"
import { getSettings } from "@fxflow/db"

export const metadata: Metadata = { title: "OANDA Settings" }
import { OandaSettingsPage } from "@/components/settings/oanda-settings-page"

export default async function OandaPage() {
  const settings = await getSettings()
  return <OandaSettingsPage initialSettings={settings} />
}
