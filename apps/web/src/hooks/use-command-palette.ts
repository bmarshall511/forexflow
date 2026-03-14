"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  LayoutDashboard,
  Crosshair,
  LineChart,
  Search,
  Radio,
  Sparkles,
  Bot,
  Settings,
  Moon,
  PanelLeft,
  ArrowLeftRight,
} from "lucide-react"
import type { CommandItem } from "@/lib/command-registry"
import { useSidebar } from "@/hooks/use-sidebar"

export function useCommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const { toggleSidebar } = useSidebar()

  const navigate = useCallback(
    (href: string) => {
      router.push(href)
      setOpen(false)
    },
    [router],
  )

  const commands: CommandItem[] = useMemo(
    () => [
      // Navigate
      {
        id: "nav-dashboard",
        label: "Dashboard",
        section: "navigate",
        icon: LayoutDashboard,
        shortcut: "G D",
        keywords: ["home"],
        action: () => navigate("/"),
      },
      {
        id: "nav-positions",
        label: "Positions",
        section: "navigate",
        icon: Crosshair,
        shortcut: "G P",
        keywords: ["trades", "open"],
        action: () => navigate("/positions"),
      },
      {
        id: "nav-charts",
        label: "Charts",
        section: "navigate",
        icon: LineChart,
        shortcut: "G C",
        keywords: ["chart", "graph"],
        action: () => navigate("/charts"),
      },
      {
        id: "nav-trade-finder",
        label: "Trade Finder",
        section: "navigate",
        icon: Search,
        keywords: ["scanner", "setups"],
        action: () => navigate("/trade-finder"),
      },
      {
        id: "nav-tv-alerts",
        label: "TradingView Alerts",
        section: "navigate",
        icon: Radio,
        keywords: ["signals", "webhook"],
        action: () => navigate("/tv-alerts"),
      },
      {
        id: "nav-ai-analysis",
        label: "AI Analysis",
        section: "navigate",
        icon: Sparkles,
        keywords: ["analysis", "insight"],
        action: () => navigate("/ai-analysis"),
      },
      {
        id: "nav-ai-trader",
        label: "AI Trader",
        section: "navigate",
        icon: Bot,
        keywords: ["autonomous", "auto"],
        action: () => navigate("/ai-trader"),
      },
      {
        id: "nav-settings",
        label: "Settings",
        section: "navigate",
        icon: Settings,
        shortcut: "G S",
        keywords: ["config", "preferences"],
        action: () => navigate("/settings"),
      },
      // Quick Settings
      {
        id: "quick-theme",
        label: resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
        section: "quick",
        icon: Moon,
        keywords: ["theme", "dark", "light"],
        action: () => {
          setTheme(resolvedTheme === "dark" ? "light" : "dark")
          setOpen(false)
        },
      },
      {
        id: "quick-sidebar",
        label: "Toggle Sidebar",
        section: "quick",
        icon: PanelLeft,
        shortcut: "Ctrl B",
        keywords: ["sidebar", "panel", "collapse"],
        action: () => {
          toggleSidebar()
          setOpen(false)
        },
      },
      {
        id: "quick-trading-mode",
        label: "Trading Mode Settings",
        section: "quick",
        icon: ArrowLeftRight,
        keywords: ["live", "practice", "demo"],
        action: () => navigate("/settings"),
      },
    ],
    [navigate, resolvedTheme, setTheme, toggleSidebar],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  return { open, setOpen, commands }
}
