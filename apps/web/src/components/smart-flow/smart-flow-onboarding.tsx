"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Zap, ClipboardList, Eye, Target, Shield, Banknote } from "lucide-react"

const STEPS = [
  {
    icon: ClipboardList,
    label: "Create a trade plan",
    desc: "Pick a currency pair and a strategy",
  },
  {
    icon: Eye,
    label: "SmartFlow watches the market",
    desc: "It monitors prices 24 hours a day, 5 days a week",
  },
  {
    icon: Target,
    label: "It enters when the time is right",
    desc: "Waits for your target price or enters immediately",
  },
  {
    icon: Shield,
    label: "It protects your money",
    desc: "Automatically sets safety exits and locks in profits",
  },
  {
    icon: Banknote,
    label: "It closes the trade for you",
    desc: "Takes profit at your target or exits safely if needed",
  },
]

interface SmartFlowOnboardingProps {
  onCreatePlan: () => void
}

export function SmartFlowOnboarding({ onCreatePlan }: SmartFlowOnboardingProps) {
  return (
    <Card>
      <CardContent className="py-10">
        <div className="mx-auto max-w-md space-y-6 text-center">
          <div className="bg-primary/10 mx-auto flex size-12 items-center justify-center rounded-full">
            <Zap className="text-primary size-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Welcome to SmartFlow</h2>
            <p className="text-muted-foreground text-sm">
              SmartFlow is your automated trading assistant. Tell it what to trade and how, and it
              handles the rest — finding the right moment, protecting your money, and closing for
              profit.
            </p>
          </div>

          <div className="space-y-3 text-left">
            <p className="text-muted-foreground text-center text-xs font-medium uppercase tracking-wider">
              How it works
            </p>
            {STEPS.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="text-muted-foreground text-xs">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Button size="lg" className="w-full gap-2" onClick={onCreatePlan}>
            <Zap className="size-4" />
            Create Your First Trade Plan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
