/**
 * Dashboard setup status — surfaces missing prerequisites (API keys,
 * whitelists, active configs, onboarding) so the new dashboard can render
 * a "Setup Needed" panel with actionable Fix links.
 *
 * Fires all seven underlying reads in parallel. Each check is independent;
 * a failure on one (e.g. the AI settings DB row doesn't exist yet) does
 * not block the others.
 */
import { NextResponse } from "next/server"
import {
  getSettings,
  getAiSettings,
  getTVAlertsConfig,
  getTradeFinderConfig,
  getAiTraderConfig,
  getOnboardingCompleted,
  countActiveConfigs,
  getSmartFlowSettings,
} from "@fxflow/db"
import type { ApiResponse, SetupCheckItem, SetupStatusResponse, TradingMode } from "@fxflow/types"

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.warn(`[setup-status] ${label} failed:`, (err as Error).message)
    return fallback
  }
}

function oandaMissingItem(mode: TradingMode, hasToken: boolean): SetupCheckItem | null {
  if (hasToken) return null
  return {
    id: "oanda_missing",
    severity: "error",
    title: `${mode === "live" ? "Live" : "Practice"} OANDA account not connected`,
    detail:
      "Without OANDA credentials the daemon can't place trades, sync history, or render live prices for this mode.",
    fixHref: "/settings/oanda",
    dismissible: false,
  }
}

export async function GET(): Promise<NextResponse<ApiResponse<SetupStatusResponse>>> {
  try {
    const [
      settings,
      aiSettings,
      tvConfig,
      tfConfig,
      aiTraderConfig,
      sfActiveConfigs,
      sfSettings,
      onboardingCompleted,
    ] = await Promise.all([
      safe("getSettings", () => getSettings(), null),
      safe("getAiSettings", () => getAiSettings(), null),
      safe("getTVAlertsConfig", () => getTVAlertsConfig(), null),
      safe("getTradeFinderConfig", () => getTradeFinderConfig(), null),
      safe("getAiTraderConfig", () => getAiTraderConfig(), null),
      safe("countActiveConfigs (smart-flow)", () => countActiveConfigs(), 0),
      safe("getSmartFlowSettings", () => getSmartFlowSettings(), null),
      safe("getOnboardingCompleted", () => getOnboardingCompleted(), true),
    ])

    const items: SetupCheckItem[] = []

    // Onboarding
    if (!onboardingCompleted) {
      items.push({
        id: "onboarding",
        severity: "error",
        title: "Finish onboarding",
        detail: "Complete the first-run setup so the rest of the app can function correctly.",
        fixHref: "/setup",
        dismissible: false,
      })
    }

    // Active account OANDA credentials
    if (settings) {
      const active = settings.tradingMode
      const hasToken =
        active === "live" ? settings.oanda.live.hasToken : settings.oanda.practice.hasToken
      const item = oandaMissingItem(active, hasToken)
      if (item) items.push(item)
    }

    // Claude API key — required for all AI features
    if (aiSettings && !aiSettings.hasClaudeKey) {
      items.push({
        id: "claude_key",
        severity: "warning",
        title: "Claude API key missing",
        detail:
          "AI Analysis, EdgeFinder, and SmartFlow AI assist all need a Claude API key to run.",
        fixHref: "/settings/ai",
        dismissible: true,
      })
    }

    // Finnhub key (economic calendar)
    if (aiSettings && !aiSettings.hasFinnhubKey) {
      items.push({
        id: "finnhub_key",
        severity: "info",
        title: "Finnhub API key missing",
        detail: "Economic calendar + news filter quality is degraded without Finnhub.",
        fixHref: "/settings/ai",
        dismissible: true,
      })
    }

    // FRED / Alpha Vantage (EdgeFinder macro data)
    if (aiTraderConfig) {
      if (!aiTraderConfig.fredApiKey) {
        items.push({
          id: "fred_key",
          severity: "info",
          title: "FRED API key missing",
          detail: "EdgeFinder macro signals (rates, employment) fall back to cached data.",
          fixHref: "/settings/ai-trader",
          dismissible: true,
        })
      }
      if (!aiTraderConfig.alphaVantageApiKey) {
        items.push({
          id: "alpha_vantage_key",
          severity: "info",
          title: "Alpha Vantage API key missing",
          detail: "EdgeFinder sentiment signals fall back to cached data.",
          fixHref: "/settings/ai-trader",
          dismissible: true,
        })
      }
    }

    // TV Alerts — only flag when enabled
    if (tvConfig?.enabled) {
      if (!tvConfig.cfWorkerUrl || !tvConfig.cfWorkerSecret) {
        items.push({
          id: "cf_worker_missing",
          severity: "error",
          title: "TradingView webhook relay not configured",
          detail:
            "TV Alerts is enabled but the CF Worker URL or secret is missing — signals will never reach the daemon.",
          fixHref: "/settings/tv-alerts",
          dismissible: false,
        })
      }
      const whitelist = tvConfig.pairWhitelist ?? []
      if (whitelist.length === 0) {
        items.push({
          id: "tv_alerts_no_whitelist",
          severity: "warning",
          title: "TV Alerts has no pair whitelist",
          detail: "Every incoming signal will be rejected until at least one pair is allowlisted.",
          fixHref: "/settings/tv-alerts",
          dismissible: true,
        })
      }
    }

    // Trade Finder — only flag when enabled
    if (tfConfig?.enabled) {
      const pairs = tfConfig.pairs ?? []
      if (pairs.length === 0) {
        items.push({
          id: "trade_finder_no_pairs",
          severity: "warning",
          title: "Trade Finder has no pairs configured",
          detail: "The scanner is enabled but has nothing to scan — add pairs in settings.",
          fixHref: "/settings/trade-finder",
          dismissible: true,
        })
      }
    }

    // EdgeFinder — only flag when enabled
    if (aiTraderConfig?.enabled) {
      const profiles = aiTraderConfig.enabledProfiles ?? {}
      const techniques = aiTraderConfig.enabledTechniques ?? {}
      if (!Object.values(profiles).some(Boolean)) {
        items.push({
          id: "edge_finder_no_profiles",
          severity: "warning",
          title: "EdgeFinder has no profiles enabled",
          detail:
            "Enable at least one strategy profile (Scalper/Intraday/Swing/News) or the scanner has nothing to run.",
          fixHref: "/settings/ai-trader",
          dismissible: true,
        })
      }
      if (!Object.values(techniques).some(Boolean)) {
        items.push({
          id: "edge_finder_no_techniques",
          severity: "warning",
          title: "EdgeFinder has no techniques enabled",
          detail: "Enable at least one analysis technique or the Tier 1 scan will always fail.",
          fixHref: "/settings/ai-trader",
          dismissible: true,
        })
      }
    }

    // SmartFlow — only flag when enabled
    if (sfSettings?.enabled && sfActiveConfigs === 0) {
      items.push({
        id: "smart_flow_no_active_configs",
        severity: "warning",
        title: "SmartFlow has no active configs",
        detail:
          "SmartFlow is enabled but no strategy configs are active — new trades won't be managed.",
        fixHref: "/smart-flow",
        dismissible: true,
      })
    }

    const data: SetupStatusResponse = {
      items,
      total: items.length,
      allConfigured: items.length === 0,
    }
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error("[GET /api/settings/setup-status]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
