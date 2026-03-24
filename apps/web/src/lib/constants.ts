import {
  LayoutDashboard,
  Crosshair,
  LineChart,
  Radio,
  Settings,
  Sparkles,
  Search,
  Bot,
  Bell,
  TrendingUp,
  Shield,
  BookOpen,
  Zap,
  type LucideIcon,
} from "lucide-react"

// Layout dimensions (px)
export const HEADER_HEIGHT = 56
export const SIDEBAR_WIDTH = 240
export const SIDEBAR_COLLAPSED_WIDTH = 64

// Sidebar cookie
export const SIDEBAR_COOKIE_NAME = "fxflow-sidebar-state"
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

// Navigation
export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badgeKey?: string
  /** Key for dynamic status text below the label (from useSidebarStatus) */
  statusKey?: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Positions", href: "/positions", icon: Crosshair, badgeKey: "positions" },
      { label: "Charts", href: "/charts", icon: LineChart },
      { label: "Analytics", href: "/analytics", icon: TrendingUp },
      { label: "Risk", href: "/risk", icon: Shield },
    ],
  },
  {
    label: "Automation",
    items: [
      {
        label: "Trade Finder",
        href: "/trade-finder",
        icon: Search,
        badgeKey: "tradeFinder",
        statusKey: "tradeFinder",
      },
      { label: "TradingView Alerts", href: "/tv-alerts", icon: Radio, badgeKey: "tvAlerts" },
      { label: "AI Analysis", href: "/ai-analysis", icon: Sparkles, badgeKey: "aiAnalysis" },
      {
        label: "EdgeFinder",
        href: "/ai-trader",
        icon: Bot,
        badgeKey: "aiTrader",
        statusKey: "aiTrader",
      },
      { label: "SmartFlow", href: "/smart-flow", icon: Zap, statusKey: "smartFlow" },
      { label: "Alerts", href: "/alerts", icon: Bell },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Documentation", href: "/docs", icon: BookOpen },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
]
