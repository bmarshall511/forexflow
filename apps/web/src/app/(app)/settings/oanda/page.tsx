import { getSettings } from "@fxflow/db"
import { OandaSettingsPage } from "@/components/settings/oanda-settings-page"

export default async function OandaPage() {
  const settings = await getSettings()
  return <OandaSettingsPage initialSettings={settings} />
}
