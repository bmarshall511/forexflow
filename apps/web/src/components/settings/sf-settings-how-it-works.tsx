"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Radar,
  Filter,
  TrendingUp,
  ShieldCheck,
  Bot,
  ArrowRight,
  BarChart3,
  LineChart,
  Activity,
  Zap,
} from "lucide-react"

function Step({
  number,
  icon,
  title,
  children,
  color,
}: {
  number: number
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  color: string
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${color} text-sm font-bold text-white`}
        >
          {number}
        </div>
        <div className="bg-border mt-2 w-px flex-1" />
      </div>
      <div className="pb-8">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <div className="text-muted-foreground mt-1.5 space-y-2 text-xs leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  )
}

function ModeCard({
  icon,
  title,
  description,
  when,
}: {
  icon: React.ReactNode
  title: string
  description: string
  when: string
}) {
  return (
    <div className="space-y-1.5 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-muted-foreground text-xs">{description}</p>
      <p className="text-xs">
        <span className="text-muted-foreground">Best when:</span>{" "}
        <span className="font-medium">{when}</span>
      </p>
    </div>
  )
}

export function SfSettingsHowItWorks() {
  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>How SmartFlow Works</CardTitle>
          <CardDescription>
            SmartFlow is your automated trading assistant. Here&apos;s exactly what happens behind
            the scenes when you turn it on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            <Step
              number={1}
              icon={<Radar className="size-4 text-blue-500" />}
              title="Scan the Market"
              color="bg-blue-500"
            >
              <p>
                Every few minutes (you choose how often), SmartFlow checks all the currency pairs
                you&apos;ve selected. It looks at price charts across multiple timeframes — like
                zooming in and out on a map to get the full picture.
              </p>
              <p>
                It runs up to 4 different analysis strategies at the same time to find the best
                opportunities (see &quot;Scan Modes&quot; below).
              </p>
            </Step>

            <Step
              number={2}
              icon={<Filter className="size-4 text-amber-500" />}
              title="Filter Out Bad Ideas"
              color="bg-amber-500"
            >
              <p>
                Not every signal is worth trading. SmartFlow runs each opportunity through 9 safety
                checks before it goes any further:
              </p>
              <ul className="list-inside list-disc space-y-1 pl-1">
                <li>Is this a good time to trade? (market session check)</li>
                <li>Is the trading cost (spread) reasonable?</li>
                <li>Do I already have too many trades on similar pairs?</li>
                <li>Is a big news event coming that could cause chaos?</li>
                <li>Does the market condition match this type of trade?</li>
                <li>Am I about to buy something that&apos;s already too expensive?</li>
                <li>Do I already have a trade on this pair?</li>
                <li>Have I hit my daily trade limit?</li>
                <li>Am I at my maximum number of open trades?</li>
              </ul>
              <p>
                If any check fails, the opportunity is logged but not traded. You can see exactly
                why in the scan details.
              </p>
            </Step>

            <Step
              number={3}
              icon={<BarChart3 className="size-4 text-violet-500" />}
              title="Score Each Opportunity"
              color="bg-violet-500"
            >
              <p>
                Opportunities that pass all filters get a quality score from 0 to 100. The score is
                based on 7 things:
              </p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                <ScoreItem
                  label="Signal agreement"
                  weight="30%"
                  desc="Do multiple indicators agree?"
                />
                <ScoreItem label="Trend direction" weight="20%" desc="Trading with the trend?" />
                <ScoreItem
                  label="Zone quality"
                  weight="15%"
                  desc="At a strong support/resistance?"
                />
                <ScoreItem label="Timing" weight="10%" desc="During busy market hours?" />
                <ScoreItem
                  label="Market conditions"
                  weight="10%"
                  desc="Right conditions for this trade type?"
                />
                <ScoreItem
                  label="Risk vs. reward"
                  weight="10%"
                  desc="Is the potential profit worth the risk?"
                />
                <ScoreItem label="Trading cost" weight="5%" desc="Is the spread reasonable?" />
              </div>
            </Step>

            <Step
              number={4}
              icon={<Zap className="size-4 text-teal-500" />}
              title="Place the Trade"
              color="bg-teal-500"
            >
              <p>
                Depending on your trading mode, SmartFlow either places the trade automatically or
                shows it to you for approval:
              </p>
              <ul className="list-inside list-disc space-y-1 pl-1">
                <li>
                  <strong>Full Auto:</strong> Places all qualifying trades instantly
                </li>
                <li>
                  <strong>Semi-Auto:</strong> Only places trades above your minimum score
                </li>
                <li>
                  <strong>Manual:</strong> Shows you the opportunity — you decide
                </li>
              </ul>
              <p>
                SmartFlow automatically picks the best strategy (Momentum, Steady Growth, etc.)
                based on current market conditions, or you can choose a fixed strategy.
              </p>
            </Step>

            <Step
              number={5}
              icon={<ShieldCheck className="size-4 text-emerald-500" />}
              title="Manage & Protect"
              color="bg-emerald-500"
            >
              <p>Once a trade is open, SmartFlow watches it every second and automatically:</p>
              <ul className="list-inside list-disc space-y-1 pl-1">
                <li>
                  <strong>Moves your stop-loss to breakeven</strong> once you&apos;re in profit — so
                  you can&apos;t lose money on a winning trade
                </li>
                <li>
                  <strong>Trails the stop-loss</strong> behind the price as it moves in your favor —
                  locking in more profit as the trade grows
                </li>
                <li>
                  <strong>Takes partial profit</strong> at milestones — banks some gains while
                  letting the rest run
                </li>
                <li>
                  <strong>Closes the trade</strong> if the loss gets too big, it&apos;s been open
                  too long, or overnight fees add up
                </li>
              </ul>
            </Step>

            <Step
              number={6}
              icon={<Bot className="size-4 text-indigo-500" />}
              title="AI Assistance (Optional)"
              color="bg-indigo-500"
            >
              <p>
                If you enable AI, SmartFlow periodically asks Claude (an AI) to review your open
                trades and suggest adjustments. The AI can:
              </p>
              <ul className="list-inside list-disc space-y-1 pl-1">
                <li>Suggest moving your stop-loss or take-profit</li>
                <li>Recommend closing early if conditions change</li>
                <li>Advise taking partial profit at good levels</li>
              </ul>
              <p>
                Depending on your settings, AI suggestions can be auto-executed or shown to you for
                approval. AI is completely optional — SmartFlow works great without it.
              </p>
            </Step>
          </div>
        </CardContent>
      </Card>

      {/* Scan modes explained */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">The 4 Scan Modes</CardTitle>
          <CardDescription>
            Each scan mode looks for a different type of trading opportunity. You can enable as many
            as you want — more modes means more chances to find trades.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ModeCard
              icon={<TrendingUp className="size-4 text-blue-500" />}
              title="Trend Following"
              description="Looks for markets moving steadily in one direction, then waits for a small pullback to enter. Like jumping on a moving train at a station stop."
              when="markets are trending (moving clearly up or down)"
            />
            <ModeCard
              icon={<Activity className="size-4 text-violet-500" />}
              title="Mean Reversion"
              description="Looks for markets that have stretched too far in one direction and are likely to snap back. Like a rubber band being pulled — eventually it returns."
              when="markets are ranging (bouncing between levels)"
            />
            <ModeCard
              icon={<ArrowRight className="size-4 text-teal-500" />}
              title="Breakout"
              description="Looks for markets that have been quiet and compressed, about to burst out with a big move. Like a coiled spring being released."
              when="markets have been quiet for a while (low volatility)"
            />
            <ModeCard
              icon={<LineChart className="size-4 text-amber-500" />}
              title="Session Momentum"
              description="Looks for strong first moves when major markets open (London or New York). The opening hours often set the direction for the day."
              when="London or New York markets first open"
            />
          </div>
        </CardContent>
      </Card>

      {/* Safety explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How You&apos;re Protected</CardTitle>
          <CardDescription>
            SmartFlow has multiple layers of protection to keep your money safe, even if something
            goes wrong.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SafetyRow
            title="Stop-Loss on Every Trade"
            desc="Every trade has a maximum loss limit. If the trade goes against you, it's automatically closed before the loss gets too big."
          />
          <SafetyRow
            title="Daily Trade Limit"
            desc="SmartFlow won't place more than a set number of trades per day. This prevents overtrading on bad days."
          />
          <SafetyRow
            title="Losing Streak Protection"
            desc="If several trades lose in a row, SmartFlow pauses automatically and waits before trying again. This prevents panic trading."
          />
          <SafetyRow
            title="Daily Loss Cap"
            desc="If your account drops by more than a set percentage in one day, all trading stops until tomorrow. This is your biggest safety net."
          />
          <SafetyRow
            title="Spread Protection"
            desc="SmartFlow won't trade when the cost of trading (spread) is unusually high — like during news events or quiet hours."
          />
          <SafetyRow
            title="News Event Avoidance"
            desc="SmartFlow checks the economic calendar and avoids placing trades right before major news announcements that could cause wild price swings."
          />
          <SafetyRow
            title="Correlation Guard"
            desc="SmartFlow avoids betting too heavily on similar currencies. If you already have a trade on EUR/USD, it won't pile into EUR/GBP too."
          />
        </CardContent>
      </Card>
    </div>
  )
}

function ScoreItem({ label, weight, desc }: { label: string; weight: string; desc: string }) {
  return (
    <div className="bg-muted/50 flex items-start gap-2 rounded-md p-2">
      <span className="shrink-0 rounded bg-violet-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-violet-600 dark:text-violet-400">
        {weight}
      </span>
      <div>
        <p className="text-xs font-medium">{label}</p>
        <p className="text-muted-foreground text-[11px]">{desc}</p>
      </div>
    </div>
  )
}

function SafetyRow({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{desc}</p>
      </div>
    </div>
  )
}
