"use client"

import { AI_MODEL_OPTIONS, type AiClaudeModel, type AiAnalysisDepth } from "@fxflow/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface AnalysisModelSelectorProps {
  model: AiClaudeModel
  depth: AiAnalysisDepth
  onModelChange: (model: AiClaudeModel) => void
  onDepthChange: (depth: AiAnalysisDepth) => void
  disabled?: boolean
}

function estimateCost(model: AiClaudeModel, depth: AiAnalysisDepth): string {
  const opt = AI_MODEL_OPTIONS.find((m) => m.id === model)
  if (!opt) return "—"
  const inputTokens = depth === "quick" ? 3_000 : depth === "standard" ? 8_000 : 18_000
  const outputTokens = depth === "quick" ? 800 : depth === "standard" ? 1_500 : 3_000
  const cost = (inputTokens / 1_000_000) * opt.inputCostPer1M + (outputTokens / 1_000_000) * opt.outputCostPer1M
  if (cost < 0.01) return "<$0.01"
  return `~$${cost.toFixed(3)}`
}

const selectClass = cn(
  "h-8 rounded-md border border-input bg-transparent px-2 text-xs outline-none",
  "focus:ring-1 focus:ring-ring cursor-pointer",
  "disabled:opacity-50 disabled:cursor-not-allowed",
)

export function AnalysisModelSelector({
  model,
  depth,
  onModelChange,
  onDepthChange,
  disabled,
}: AnalysisModelSelectorProps) {
  const selectedOpt = AI_MODEL_OPTIONS.find((m) => m.id === model)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={model}
        onChange={(e) => onModelChange(e.target.value as AiClaudeModel)}
        disabled={disabled}
        aria-label="Claude model"
        className={selectClass}
      >
        {AI_MODEL_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.name}</option>
        ))}
      </select>

      <select
        value={depth}
        onChange={(e) => onDepthChange(e.target.value as AiAnalysisDepth)}
        disabled={disabled}
        aria-label="Analysis depth"
        className={selectClass}
      >
        <option value="quick">Quick</option>
        <option value="standard">Standard</option>
        <option value="deep">Deep</option>
      </select>

      <Badge variant="outline" className="h-6 text-[10px] text-muted-foreground font-normal">
        Est. {estimateCost(model, depth)}
      </Badge>

      {selectedOpt && (
        <Badge variant="outline" className="h-6 text-[10px] text-muted-foreground font-normal">
          ~{selectedOpt.estimatedDurationSec}s
        </Badge>
      )}
    </div>
  )
}
