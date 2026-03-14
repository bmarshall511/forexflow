"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useSidebar } from "@/hooks/use-sidebar"
import { SidebarNav } from "./sidebar-nav"
import { Logo } from "./logo"

export function MobileSidebar() {
  const { isMobileOpen, setMobileOpen } = useSidebar()

  return (
    <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="bg-sidebar w-[var(--sidebar-width)] p-0">
        <SheetHeader className="border-sidebar-border flex h-[var(--header-height)] items-center border-b px-4">
          <SheetTitle className="sr-only">FXFlow Navigation</SheetTitle>
          <Logo variant="full" />
        </SheetHeader>
        <SidebarNav />
      </SheetContent>
    </Sheet>
  )
}
