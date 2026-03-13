"use client"

import { PanelLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/hooks/use-sidebar"
import { SidebarNav } from "./sidebar-nav"
import { Logo } from "./logo"
import { cn } from "@/lib/utils"

export function Sidebar() {
  const { isOpen, toggleSidebar } = useSidebar()

  return (
    <aside
      id="main-sidebar"
      aria-label="Main navigation"
      className={cn(
        "hidden md:flex flex-col border-r border-sidebar-border bg-sidebar",
        "sticky top-0 h-screen self-start",
        "transition-[width] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
        "overflow-hidden shrink-0",
        isOpen ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-collapsed-width)]",
      )}
    >
      {/* Branding + toggle */}
      <div className="flex h-[var(--header-height)] shrink-0 items-center border-b border-sidebar-border px-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleSidebar}
          aria-expanded={isOpen}
          aria-controls="main-sidebar"
          aria-label="Toggle sidebar"
          className="shrink-0"
        >
          <PanelLeft className="size-4" />
        </Button>
        {isOpen ? (
          <Logo variant="full" className="ml-2" />
        ) : (
          <Logo variant="icon" className="ml-1" />
        )}
      </div>

      <SidebarNav />
    </aside>
  )
}
