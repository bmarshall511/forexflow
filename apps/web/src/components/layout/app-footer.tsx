"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatVersion, formatBuildInfo } from "@/lib/version"

const CURRENT_YEAR = new Date().getFullYear()

const DISCLAIMER =
  "Not financial advice. Trading forex involves substantial risk of loss. Past performance is not indicative of future results."

export function AppFooter() {
  const version = formatVersion()
  const buildInfo = formatBuildInfo()

  return (
    <footer
      role="contentinfo"
      className="border-border text-muted-foreground border-t px-4 py-2 text-xs"
    >
      <p className="text-muted-foreground/50 mb-1.5 text-[10px] leading-tight">{DISCLAIMER}</p>
      <div className="flex items-center justify-between">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded px-1 py-0.5 font-mono transition-colors focus-visible:outline-none focus-visible:ring-1"
            >
              {version}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{buildInfo}</TooltipContent>
        </Tooltip>

        <span>&copy; {CURRENT_YEAR} FXFlow</span>
      </div>
    </footer>
  )
}
