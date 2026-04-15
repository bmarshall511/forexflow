"use client"

/**
 * SmartFlow Trade Review drawer — post-mortem detail view for a closed trade.
 *
 * Thin shadcn `Sheet` wrapper. Body + sub-components live in sibling files
 * so each stays under the project's ≤150-LOC component rule:
 *
 *   - `trade-review-body.tsx`      — header + tiles + entry context + sections
 *   - `trade-review-timeline.tsx`  — merge-sorted event list
 *   - `trade-review-utils.ts`      — formatting helpers + `buildTimeline`
 *
 * Purely a consumer of `SmartFlowTradeData` — no extra fetches.
 */

import type { SmartFlowTradeData } from "@fxflow/types"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { TradeReviewBody } from "./trade-review-body"

export interface TradeReviewDrawerProps {
  trade: SmartFlowTradeData | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TradeReviewDrawer({ trade, open, onOpenChange }: TradeReviewDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-[520px] overflow-y-auto sm:max-w-[540px]">
        {trade ? <TradeReviewBody trade={trade} /> : null}
      </SheetContent>
    </Sheet>
  )
}
