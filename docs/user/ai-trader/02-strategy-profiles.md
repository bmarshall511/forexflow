---
title: "Strategy Profiles"
description: "Learn about the 4 trading styles the AI can use: Scalper, Intraday, Swing, and News"
category: "ai-trader"
order: 2
---

# Strategy Profiles

A strategy profile tells the AI Trader **how** to trade. Think of it like choosing a sport — each one has different rules, different speeds, and different skills. You pick the style that fits your life.

FXFlow has 4 strategy profiles. You can enable one or several at the same time.

---

## Scalper — The Sprinter

**How long trades last:** 5 to 15 minutes

**The analogy:** A scalper is like a sprinter in a race. They explode out of the starting blocks, run as fast as they can, and the race is over in seconds. Quick in, quick out, grab a small profit, repeat.

**Charts it watches:** 5-minute, 15-minute, and 1-hour

**Minimum reward-to-risk:** 1.5:1

> [!FOREX]
> **Reward-to-risk** means how much you could win compared to how much you could lose. A 1.5:1 ratio means if you risk losing $10, you're aiming to make at least $15. The AI won't take trades with worse odds than this.

**Best for:** People who are actively watching their screens and want to see quick results.

> [!WARNING]
> Scalping requires fast markets and tight spreads. It's the most demanding profile and generates the most AI API calls since trades happen so quickly. Not recommended for beginners.

---

## Intraday — The Day Worker

**How long trades last:** 1 to 4 hours, always closed before the trading day ends

**The analogy:** An intraday trader is like someone with a regular day job. They show up in the morning, do their work during business hours, and go home at the end of the day. No overnight surprises — all positions are closed by the time you go to sleep.

**Charts it watches:** 15-minute, 1-hour, and 4-hour

**Minimum reward-to-risk:** 2:1

**Best for:** People who can check their phone a few times during the day but don't want to stare at screens constantly.

---

## Swing — The Gardener

**How long trades last:** 1 to 5 days

**The analogy:** A swing trader is like a gardener. You plant a seed (enter the trade), water it occasionally (check in once a day), and wait patiently for it to grow. You're not rushing — you're letting the natural cycle do the work.

**Charts it watches:** 4-hour, daily, and weekly

**Minimum reward-to-risk:** 2.5:1

**Best for:** Patient people who only want to check their trades once a day. Also great for people with busy schedules.

> [!TIP]
> **If you're brand new, start with Swing.** It's the most forgiving profile. Trades develop slowly, so you have time to learn. The higher reward-to-risk ratio (2.5:1) means each winner more than covers your losses. And you only need to check in once a day.

---

## News — The Sports Bettor

**How long trades last:** 5 minutes to a few hours, timed around economic events

**The analogy:** Trading the news is like betting on a sports game. You know the game is happening at a specific time (the news release), you study the teams (economic expectations), and you place your bet before or right after the whistle blows. Big moves can happen in seconds.

**Charts it watches:** 5-minute, 15-minute, and 1-hour

**Minimum reward-to-risk:** 1.5:1

**What kind of news?** Things like:

- **Jobs reports** — how many people got hired or fired last month
- **Interest rate decisions** — the government deciding whether to make borrowing money cheaper or more expensive
- **Inflation data** — whether prices of everyday things are going up too fast

> [!WARNING]
> News trading is unpredictable. Prices can jump wildly in either direction. The AI accounts for this, but news trades carry more risk than other profiles.

---

## Comparison Table

| Feature             | Scalper     | Intraday      | Swing    | News             |
| ------------------- | ----------- | ------------- | -------- | ---------------- |
| Trade duration      | 5-15 min    | 1-4 hours     | 1-5 days | Minutes to hours |
| Charts used         | 5m, 15m, 1h | 15m, 1h, 4h   | 4h, D, W | 5m, 15m, 1h      |
| Min reward:risk     | 1.5:1       | 2:1           | 2.5:1    | 1.5:1            |
| Check frequency     | Constantly  | Few times/day | Once/day | Around events    |
| API cost per scan   | Higher      | Medium        | Lower    | Medium           |
| Beginner friendly   | No          | Somewhat      | Yes      | No               |
| Overnight positions | No          | No            | Yes      | Rarely           |

---

## Using Multiple Profiles

You can turn on more than one profile at the same time. For example:

- **Swing + Intraday** — catch both slow-developing and same-day opportunities
- **Swing + News** — ride long trends and also jump on big news moves

The AI will look for opportunities that match ANY of your active profiles. Each trade is tagged with which profile triggered it, so you always know why a trade was taken.

> [!NOTE]
> More active profiles means more scanning and potentially more trades. Keep an eye on your daily budget and max concurrent trades settings to stay in control.

---

## Changing Profiles

You can enable or disable profiles at any time from **Settings > AI Trader**. Changes take effect on the next scan cycle. Any trades already open will continue to be managed — changing profiles only affects future scans.
