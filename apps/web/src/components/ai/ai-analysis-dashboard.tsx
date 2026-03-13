"use client"

import { useState } from "react"
import Link from "next/link"
import { Sparkles, ListChecks, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TabNav, TabNavButton } from "@/components/ui/tab-nav"
import { AiStatsBar } from "./ai-stats-bar"
import { AiAnalysesTab } from "./ai-analyses-tab"
import { AiConditionsTab } from "./ai-conditions-tab"

type Tab = "analyses" | "conditions"

export function AiAnalysisDashboard() {
  const [tab, setTab] = useState<Tab>("analyses")

  return (
    <div className="min-h-screen">
      {/* ─── Hero Header ─── */}
      <div className="px-4 md:px-6 pt-6 pb-8 border-b">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Analysis</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              All AI analyses and automated conditions across your trades
            </p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 shrink-0" asChild>
            <Link href="/settings/ai">
              <Settings2 className="size-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </Button>
        </div>

        <AiStatsBar />
      </div>

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
      <div className="px-4 md:px-6 py-6 space-y-4">
        {tab === "analyses" && <AiAnalysesTab />}
        {tab === "conditions" && <AiConditionsTab />}
      </div>
    </div>
  )
}
