"use client"

import { PanelLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/hooks/use-sidebar"

/** Mobile-only hamburger button for the header. Desktop toggle lives in the sidebar. */
export function MobileSidebarToggle() {
  const { toggleMobileSidebar } = useSidebar()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleMobileSidebar}
      aria-label="Open navigation menu"
      className="md:hidden"
    >
      <PanelLeft className="size-5" />
    </Button>
  )
}
