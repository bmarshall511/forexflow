"use client"

import { useContext } from "react"
import { SidebarContext } from "@/state/sidebar-context"

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}
