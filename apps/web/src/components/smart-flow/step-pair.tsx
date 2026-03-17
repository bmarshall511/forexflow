"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Info, Sparkles, Check, Loader2, Globe2, ExternalLink } from "lucide-react"
import { FOREX_PAIR_GROUPS } from "@fxflow/shared"

export interface AiFullSuggestion {
  direction: "long" | "short"
  confidence: number
  reasoning: string[]
  factors: string[]
  suggestedStrategy?: string
  strategyReason?: string
}

interface StepPairProps {
  pair: string
  onSelect: (v: string) => void
  search: string
  onSearch: (v: string) => void
  onAiQuickStart?: (result: AiFullSuggestion) => void
}

export function StepPair({ pair, onSelect, search, onSearch, onAiQuickStart }: StepPairProps) {
  const [aiState, setAiState] = useState<"idle" | "loading" | "error" | "no-key">("idle")
  const [aiError, setAiError] = useState("")

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return FOREX_PAIR_GROUPS
    return FOREX_PAIR_GROUPS.map((g) => ({
      ...g,
      pairs: g.pairs.filter(
        (p) => p.label.toLowerCase().includes(q) || p.value.toLowerCase().includes(q),
      ),
    })).filter((g) => g.pairs.length > 0)
  }, [search])

  async function handleAiAnalyze() {
    if (!pair) return
    setAiState("loading")
    try {
      const settingsRes = await fetch("/api/ai/settings")
      const sj = (await settingsRes.json()) as { ok: boolean; data?: { hasClaudeKey: boolean } }
      if (!sj.ok || !sj.data?.hasClaudeKey) {
        setAiState("no-key")
        return
      }

      const res = await fetch("/api/smart-flow/ai-direction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrument: pair, includeStrategy: true }),
      })
      const json = (await res.json()) as { ok: boolean; data?: AiFullSuggestion; error?: string }
      if (!json.ok || !json.data) {
        setAiError(json.error ?? "Analysis failed")
        setAiState("error")
        return
      }

      setAiState("idle")
      onAiQuickStart?.(json.data)
    } catch {
      setAiError("Network error")
      setAiState("error")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
        <Info className="mt-0.5 size-4 shrink-0 text-blue-500" aria-hidden="true" />
        <p className="text-muted-foreground text-sm leading-relaxed">
          Currency pairs show two currencies. <strong>EUR/USD</strong> means Euro vs US Dollar. When
          you buy, you&apos;re betting the first currency will get stronger.
        </p>
      </div>

      <div className="relative">
        <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search pairs..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="min-h-[44px] pl-9"
          aria-label="Search currency pairs"
        />
      </div>

      {pair && (
        <div className="overflow-hidden rounded-xl border-2 border-dashed border-indigo-500/30 bg-indigo-500/5">
          {aiState === "idle" && (
            <button
              type="button"
              onClick={handleAiAnalyze}
              className="flex min-h-[52px] w-full items-center gap-3 p-4 text-left transition-colors hover:bg-indigo-500/10"
            >
              <Sparkles className="size-5 text-indigo-500" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">AI Quick Start</div>
                <p className="text-muted-foreground text-xs">
                  Let AI analyze {pair.replace("_", "/")} and auto-pick direction + strategy for you
                </p>
              </div>
            </button>
          )}
          {aiState === "loading" && (
            <div className="flex items-center gap-3 p-4">
              <Loader2 className="size-5 animate-spin text-indigo-500" />
              <span className="text-sm font-medium text-indigo-400">
                Analyzing {pair.replace("_", "/")}...
              </span>
            </div>
          )}
          {aiState === "no-key" && (
            <div className="p-4">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Set up your Claude API key in{" "}
                <a
                  href="/settings/ai"
                  className="inline-flex items-center gap-1 font-medium underline"
                >
                  <span>Settings</span> <ExternalLink className="size-3" />
                </a>{" "}
                to use AI features.
              </p>
            </div>
          )}
          {aiState === "error" && (
            <div className="p-4">
              <p className="text-sm text-red-500">{aiError}</p>
              <button
                type="button"
                onClick={handleAiAnalyze}
                className="mt-1 text-xs font-medium text-red-500 underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}

      {filtered.map((group) => (
        <div key={group.label}>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold">{group.label}</h3>
            {group.label === "Majors" && (
              <Badge variant="secondary" className="text-[10px]">
                Recommended for beginners
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {group.pairs.map((p) => {
              const isSelected = pair === p.value
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => onSelect(p.value)}
                  aria-pressed={isSelected}
                  className={`group relative flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary scale-[1.02] shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  }`}
                >
                  <Globe2
                    className={`size-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span>{p.label}</span>
                  {isSelected && (
                    <span className="bg-primary text-primary-foreground absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full">
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
