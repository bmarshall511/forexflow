"use client"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const GLOSSARY: Record<string, { plain: string; tip: string }> = {
  "stop-loss": {
    plain: "Safety Exit",
    tip: "The price where SmartFlow closes your trade to prevent bigger losses",
  },
  "take-profit": {
    plain: "Profit Target",
    tip: "The price where SmartFlow closes your trade to lock in your gains",
  },
  atr: {
    plain: "Typical Movement",
    tip: "How much this currency pair usually moves in a day, measured in pips",
  },
  breakeven: {
    plain: "Break-Even",
    tip: "Moving your safety exit to your entry price — so you can't lose money on this trade",
  },
  trailing: {
    plain: "Trailing Protection",
    tip: "Your safety exit follows the price as it moves in your favor, locking in profits",
  },
  "risk-reward": {
    plain: "Risk vs Reward",
    tip: "How much you could gain compared to how much you could lose. 2:1 means gaining $2 for every $1 risked",
  },
  pips: {
    plain: "Price Points",
    tip: "The smallest price movement in forex — like cents for currencies",
  },
  spread: {
    plain: "Trading Fee",
    tip: "The small cost of entering a trade — a fee built into the price difference",
  },
  long: {
    plain: "Buying",
    tip: "Betting that the price will go up",
  },
  short: {
    plain: "Selling",
    tip: "Betting that the price will go down",
  },
}

interface ExplainProps {
  term: keyof typeof GLOSSARY | string
  children: React.ReactNode
  className?: string
}

export function Explain({ term, children, className }: ExplainProps) {
  const entry = GLOSSARY[term]
  if (!entry) return <span className={className}>{children}</span>

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("border-current/30 cursor-help border-b border-dotted", className)}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs font-medium">{entry.plain}</p>
          <p className="text-muted-foreground text-[11px]">{entry.tip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Get the plain English name for a term. */
export function getPlainName(term: string): string {
  return GLOSSARY[term]?.plain ?? term
}
