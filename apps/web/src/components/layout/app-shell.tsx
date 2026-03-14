"use client"

import { useCallback, useState } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Header } from "./header"
import { Sidebar } from "./sidebar"
import { MobileSidebar } from "./mobile-sidebar"
import { OfflineBanner } from "./offline-banner"
import { CommandPalette } from "@/components/ui/command-palette"
import { ShortcutsHelp } from "@/components/ui/shortcuts-help"
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut"
import { useNavigationShortcuts } from "@/hooks/use-navigation-shortcuts"
import { useCommandPalette } from "@/hooks/use-command-palette"
import { useSidebar } from "@/hooks/use-sidebar"
import { useIsMobile } from "@/hooks/use-is-mobile"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { toggleSidebar, toggleMobileSidebar } = useSidebar()
  const isMobile = useIsMobile()
  const { open: paletteOpen, setOpen: setPaletteOpen, commands } = useCommandPalette()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const handleToggle = useCallback(() => {
    if (isMobile) {
      toggleMobileSidebar()
    } else {
      toggleSidebar()
    }
  }, [isMobile, toggleSidebar, toggleMobileSidebar])

  const handleShortcutsToggle = useCallback(() => {
    setShortcutsOpen((prev) => !prev)
  }, [])

  useKeyboardShortcut("b", handleToggle, { ctrlOrMeta: true })
  useNavigationShortcuts(handleShortcutsToggle)

  return (
    <TooltipProvider delayDuration={0}>
      {/* Skip to content link */}
      <a
        href="#main-content"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <div className="flex min-h-screen flex-col">
        <OfflineBanner />
        <div className="flex flex-1">
          <Sidebar />
          <MobileSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main id="main-content" className="flex-1" role="main">
              {children}
            </main>
          </div>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />
      <ShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </TooltipProvider>
  )
}
