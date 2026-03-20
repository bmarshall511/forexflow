"use client"

import { useState, useEffect } from "react"
import { Search, Zap, Brain, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "fxflow-ai-pipeline-dismissed"

const STEPS = [
  {
    icon: Search,
    title: "Scans the market",
    description: "Checks price patterns and chart structure on your selected pairs",
    color: "text-blue-500",
  },
  {
    icon: Zap,
    title: "Quick AI check",
    description: "A fast AI model filters out weak signals to save time and cost",
    color: "text-amber-500",
  },
  {
    icon: Brain,
    title: "Deep AI analysis",
    description:
      "A thorough AI model decides if it's worth trading and sets entry, stop-loss, and target",
    color: "text-emerald-500",
  },
] as const

export function PipelineExplainer() {
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "true")
  }, [])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  return (
    <div className="bg-muted/30 mb-4 rounded-lg border p-3">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between text-left"
      >
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          How EdgeFinder Works
        </p>
        {collapsed ? (
          <ChevronDown className="text-muted-foreground size-3.5" />
        ) : (
          <ChevronUp className="text-muted-foreground size-3.5" />
        )}
      </button>

      {!collapsed && (
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={i} className="bg-background flex items-start gap-2.5 rounded-md border p-2.5">
              <div
                className={cn(
                  "bg-current/10 flex size-7 shrink-0 items-center justify-center rounded-full",
                  step.color,
                )}
              >
                <step.icon className="size-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium">{step.title}</p>
                <p className="text-muted-foreground text-[10px] leading-snug">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
