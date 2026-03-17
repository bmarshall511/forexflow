"use client"

import { useState } from "react"
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react"

interface AiSuggestion {
  direction: "long" | "short"
  confidence: number
  reasoning: string[]
  factors: string[]
}

export function StepDirection({
  pair,
  direction,
  onSelect,
}: {
  pair: string
  direction: "long" | "short" | null
  onSelect: (v: "long" | "short") => void
}) {
  const [aiState, setAiState] = useState<"idle" | "loading" | "done" | "no-key" | "error">("idle")
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null)
  const [aiExpanded, setAiExpanded] = useState(true)
  const [aiError, setAiError] = useState("")

  async function handleAiDecide() {
    setAiState("loading")
    setAiError("")
    try {
      // Check if API key is configured
      const settingsRes = await fetch("/api/ai/settings")
      const settingsJson = (await settingsRes.json()) as {
        ok: boolean
        data?: { hasClaudeKey: boolean }
      }
      if (!settingsJson.ok || !settingsJson.data?.hasClaudeKey) {
        setAiState("no-key")
        return
      }

      const res = await fetch("/api/smart-flow/ai-direction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrument: pair }),
      })
      const json = (await res.json()) as { ok: boolean; data?: AiSuggestion; error?: string }
      if (!json.ok || !json.data) {
        setAiError(json.error ?? "AI analysis failed")
        setAiState("error")
        return
      }
      setAiSuggestion(json.data)
      setAiState("done")
      onSelect(json.data.direction)
    } catch {
      setAiError("Network error — could not reach AI")
      setAiState("error")
    }
  }

  const pairLabel = pair.replace("_", "/")

  return (
    <div className="space-y-4">
      {/* Buy / Sell cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DirectionCard
          type="long"
          selected={direction === "long"}
          onSelect={() => onSelect("long")}
        />
        <DirectionCard
          type="short"
          selected={direction === "short"}
          onSelect={() => onSelect("short")}
        />
      </div>

      {/* AI Decide section */}
      <div className="relative">
        <div className="absolute inset-x-0 top-0 flex items-center justify-center">
          <span className="bg-background text-muted-foreground px-3 text-xs">or</span>
        </div>
        <hr className="border-border" />
      </div>

      {aiState === "idle" && (
        <button
          type="button"
          onClick={handleAiDecide}
          className="border-border hover:border-primary/40 hover:bg-muted/50 flex min-h-[60px] w-full items-center gap-4 rounded-xl border-2 border-dashed p-4 text-left transition-all"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
            <Sparkles className="size-5 text-indigo-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Let AI Decide</div>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              AI will analyze market conditions and trends to suggest the best direction
            </p>
          </div>
        </button>
      )}

      {aiState === "loading" && (
        <div className="flex min-h-[60px] items-center gap-4 rounded-xl border-2 border-indigo-500/30 bg-indigo-500/5 p-4">
          <div className="size-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-sm font-medium text-indigo-400">Analyzing {pairLabel}...</span>
        </div>
      )}

      {aiState === "no-key" && (
        <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-300">
            Set up your Claude API key in{" "}
            <a
              href="/settings/ai"
              className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
            >
              Settings &rarr; AI <ExternalLink className="size-3" />
            </a>{" "}
            to use this feature.
          </p>
        </div>
      )}

      {aiState === "error" && (
        <div className="rounded-xl border-2 border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm text-red-400">{aiError}</p>
          <button
            type="button"
            onClick={handleAiDecide}
            className="mt-2 text-xs font-medium text-red-400 underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {aiState === "done" && aiSuggestion && (
        <AiSuggestionCard
          suggestion={aiSuggestion}
          expanded={aiExpanded}
          onToggle={() => setAiExpanded(!aiExpanded)}
        />
      )}

      <p className="text-muted-foreground text-center text-xs">
        Not sure? Start with a Majors pair and Buy — it&apos;s the simplest way to begin.
      </p>
    </div>
  )
}

function DirectionCard({
  type,
  selected,
  onSelect,
}: {
  type: "long" | "short"
  selected: boolean
  onSelect: () => void
}) {
  const isLong = type === "long"
  const Icon = isLong ? TrendingUp : TrendingDown
  const color = isLong ? "emerald" : "red"

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative min-h-[44px] rounded-xl border-2 p-5 text-left transition-all ${
        selected
          ? `border-${color}-500 bg-${color}-500/10 shadow-sm shadow-${color}-500/20`
          : `border-border hover:border-${color}-500/50 hover:bg-${color}-500/5`
      }`}
      style={{
        borderColor: selected ? (isLong ? "rgb(16 185 129)" : "rgb(239 68 68)") : undefined,
        backgroundColor: selected
          ? isLong
            ? "rgba(16, 185, 129, 0.1)"
            : "rgba(239, 68, 68, 0.1)"
          : undefined,
      }}
    >
      <Icon
        className="mb-2 size-8"
        style={{ color: isLong ? "rgb(16 185 129)" : "rgb(239 68 68)" }}
      />
      <div className="text-base font-semibold">{isLong ? "Buy (Long)" : "Sell (Short)"}</div>
      <p className="text-muted-foreground mt-1 text-sm">
        {isLong ? "Price goes UP = You profit" : "Price goes DOWN = You profit"}
      </p>
      {selected && (
        <span
          className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full text-xs text-white"
          style={{ backgroundColor: isLong ? "rgb(16 185 129)" : "rgb(239 68 68)" }}
        >
          ✓
        </span>
      )}
    </button>
  )
}

function AiSuggestionCard({
  suggestion,
  expanded,
  onToggle,
}: {
  suggestion: AiSuggestion
  expanded: boolean
  onToggle: () => void
}) {
  const isLong = suggestion.direction === "long"

  return (
    <div className="overflow-hidden rounded-xl border-2 border-indigo-500/30 bg-indigo-500/5">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-[44px] w-full items-center gap-3 p-4 text-left"
        aria-expanded={expanded}
      >
        <Sparkles className="size-4 text-indigo-400" />
        <div className="flex-1">
          <span className="text-sm font-semibold">AI suggests: </span>
          <span
            className="text-sm font-bold"
            style={{ color: isLong ? "rgb(16 185 129)" : "rgb(239 68 68)" }}
          >
            {isLong ? "Buy (Long)" : "Sell (Short)"}
          </span>
          <span className="text-muted-foreground ml-2 text-xs">
            {suggestion.confidence}% confidence
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="text-muted-foreground size-4" />
        ) : (
          <ChevronDown className="text-muted-foreground size-4" />
        )}
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-indigo-500/20 px-4 pb-4 pt-3">
          {/* Confidence bar */}
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Confidence</span>
              <span className="font-medium">{suggestion.confidence}%</span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${suggestion.confidence}%` }}
              />
            </div>
          </div>
          {/* Reasoning */}
          <ul className="space-y-1.5" aria-label="AI reasoning">
            {suggestion.reasoning.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="text-muted-foreground mt-0.5 shrink-0">&#x2022;</span>
                <span className="text-foreground/80">{r}</span>
              </li>
            ))}
          </ul>
          {/* Factors */}
          <div className="flex flex-wrap gap-1.5">
            {suggestion.factors.map((f, i) => (
              <span
                key={i}
                className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-400"
              >
                {f}
              </span>
            ))}
          </div>
          <p className="text-muted-foreground text-[10px]">
            You can override by clicking Buy or Sell above.
          </p>
        </div>
      )}
    </div>
  )
}
