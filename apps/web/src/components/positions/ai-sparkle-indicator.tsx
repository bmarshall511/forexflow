"use client"

import type { AiAnalysisData } from "@fxflow/types"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Sparkles } from "lucide-react"

interface AiSparkleIndicatorProps {
  analysis: AiAnalysisData
  onClick: () => void
}

/** Inline sparkle icon shown next to the pair name when an AI analysis exists */
export function AiSparkleIndicator({ analysis, onClick }: AiSparkleIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
          className="text-primary/60 hover:text-primary transition-colors"
        >
          <Sparkles className="size-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {analysis.sections
          ? `Win ${analysis.sections.winProbability}% · Q ${analysis.sections.tradeQualityScore}/10`
          : "View analysis"}
      </TooltipContent>
    </Tooltip>
  )
}
