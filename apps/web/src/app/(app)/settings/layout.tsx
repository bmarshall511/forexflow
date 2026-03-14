import { SettingsNav } from "@/components/settings/settings-nav"
import { PageHeader } from "@/components/ui/page-header"
import { Settings } from "lucide-react"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full w-full">
      <PageHeader
        title="Settings"
        subtitle="Platform configuration and preferences"
        icon={Settings}
      />

      <div className="flex flex-col gap-6 px-4 pb-6 md:flex-row md:px-6">
        {/* Sidebar nav */}
        <aside className="w-full shrink-0 md:w-48">
          <SettingsNav />
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
