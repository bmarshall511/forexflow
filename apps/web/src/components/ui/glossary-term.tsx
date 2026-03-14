"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { GLOSSARY } from "./glossary-data"

export function GlossaryTerm({ term, children }: { term: string; children: React.ReactNode }) {
  const definition = GLOSSARY[term.toLowerCase()]
  if (!definition) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="decoration-muted-foreground/50 cursor-help underline decoration-dotted">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-sm">{definition}</TooltipContent>
    </Tooltip>
  )
}
