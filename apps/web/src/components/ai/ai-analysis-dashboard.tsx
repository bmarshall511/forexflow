"use client"

import { useState } from "react"
import Link from "next/link"
import { Sparkles, ListChecks, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TabNav, TabNavButton } from "@/components/ui/tab-nav"
import { PageHeader } from "@/components/ui/page-header"
import { AiStatsBar } from "./ai-stats-bar"
import { AiAnalysesTab } from "./ai-analyses-tab"
import { AiConditionsTab } from "./ai-conditions-tab"

type Tab = "analyses" | "conditions"

export function AiAnalysisDashboard() {
  const [tab, setTab] = useState<Tab>("analyses")

  return (
    <div className="min-h-screen">
      {/* ─── Hero Header ─── */}
      <PageHeader
        title="AI Analysis"
        subtitle="All AI analyses and automated conditions across your trades"
        icon={Sparkles}
        bordered
        actions={
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" asChild>
            <Link href="/settings/ai">
              <Settings2 className="size-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </Button>
        }
      >
        <AiStatsBar />
      </PageHeader>

      {/* ─── Tab Navigation ─── */}
      <TabNav label="AI Analysis sections">
        <TabNavButton
          active={tab === "analyses"}
          onClick={() => setTab("analyses")}
          icon={<Sparkles className="size-3.5" />}
          label="Analyses"
          count={0}
        />
        <TabNavButton
          active={tab === "conditions"}
          onClick={() => setTab("conditions")}
          icon={<ListChecks className="size-3.5" />}
          label="Conditions"
          count={0}
        />
      </TabNav>

      {/* ─── Tab Content ─── */}
      <div className="space-y-4 px-4 py-6 md:px-6">
        {tab === "analyses" && <AiAnalysesTab />}
        {tab === "conditions" && <AiConditionsTab />}
      </div>
    </div>
  )
}
