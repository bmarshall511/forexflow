import { Radio, Search, Bot } from "lucide-react"

const features = [
  {
    icon: Radio,
    name: "TradingView Alerts",
    description:
      "Receive TradingView webhook signals and auto-execute trades. Configure alert routing, position sizing, and risk limits.",
  },
  {
    icon: Search,
    name: "Trade Finder",
    description:
      "Automatically scans supply & demand zones across pairs and timeframes to surface high-probability setups.",
  },
  {
    icon: Bot,
    name: "AI Trader",
    description:
      "Autonomous trading with a 3-tier AI pipeline: local technical analysis, Haiku filtering, and Sonnet decision-making.",
  },
] as const

export function OnboardingFeatures() {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="text-2xl font-bold tracking-tight">Explore Features</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        FXFlow has several automation features you can enable from their settings pages when
        you&apos;re ready.
      </p>

      <div className="mt-8 w-full max-w-md space-y-4">
        {features.map(({ icon: Icon, name, description }) => (
          <div
            key={name}
            className="border-border bg-card flex items-start gap-4 rounded-lg border p-4 text-left"
          >
            <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Icon className="text-primary size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{name}</p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{description}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground mt-6 text-xs">
        Each feature can be configured independently from its settings page.
      </p>
    </div>
  )
}
