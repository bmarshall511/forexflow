import { BarChart3, Bot, LineChart, Radio, Shield } from "lucide-react"
import { Logo } from "@/components/layout/logo"

const features = [
  { icon: LineChart, label: "Real-time OANDA account monitoring and P&L tracking" },
  { icon: Radio, label: "TradingView webhook alerts with auto-trade execution" },
  { icon: BarChart3, label: "Supply & demand zone detection and trade finder" },
  { icon: Bot, label: "AI-powered trade analysis and autonomous trading" },
  { icon: Shield, label: "Risk management with position sizing and daily limits" },
] as const

export function OnboardingWelcome() {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        Welcome to <Logo variant="full" className="translate-y-0.5" />
      </h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        Your forex trading command center. Let&apos;s get you set up in a few quick steps.
      </p>
      <ul className="mt-8 w-full max-w-md space-y-3 text-left" role="list">
        {features.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-3">
            <div className="bg-primary/10 flex size-8 shrink-0 items-center justify-center rounded-lg">
              <Icon className="text-primary size-4" />
            </div>
            <span className="text-sm">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
