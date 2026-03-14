"use client"

import { useCallback } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Header } from "./header"
import { Sidebar } from "./sidebar"
import { MobileSidebar } from "./mobile-sidebar"
import { OfflineBanner } from "./offline-banner"
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut"
import { useSidebar } from "@/hooks/use-sidebar"
import { useIsMobile } from "@/hooks/use-is-mobile"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { toggleSidebar, toggleMobileSidebar } = useSidebar()
  const isMobile = useIsMobile()

  const handleToggle = useCallback(() => {
    if (isMobile) {
      toggleMobileSidebar()
    } else {
      toggleSidebar()
    }
  }, [isMobile, toggleSidebar, toggleMobileSidebar])

  useKeyboardShortcut("b", handleToggle, { ctrlOrMeta: true })

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
    </TooltipProvider>
  )
}
